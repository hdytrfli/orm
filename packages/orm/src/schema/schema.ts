import type { IndexDescription, IndexDirection, ObjectId } from 'mongodb';
import { z } from 'zod';

import type { PopulateSpecs } from '../query/query.js';
import { collectRefs } from '../relations/definitions.js';
import type {
  RelationInput,
  RelationInputTarget,
  RelationMap,
  SchemaRelation,
  SchemaRelationMap,
  SchemaLike,
} from '../relations/definitions.js';
import type { SchemaDefinition, SchemaShape } from './contracts.js';
import type { InferShape } from './inference.js';

/** Built-in persistence behavior applied by a schema. */
export interface SchemaOptions {
  readonly timestamps?: boolean;
  readonly softdelete?: boolean;
}

export type SchemaIndexFields<Shape extends SchemaShape> = Partial<
  Record<Extract<keyof Shape, string>, IndexDirection>
>;

export type SchemaIndex<Shape extends SchemaShape> = {
  readonly fields: SchemaIndexFields<Shape>;
  readonly options?: Omit<IndexDescription, 'key'>;
};

type TimestampShape = {
  createdAt: z.ZodDefault<z.ZodDate>;
  updatedAt: z.ZodDefault<z.ZodDate>;
};

type SoftDeleteShape = {
  deletedAt: z.ZodDefault<z.ZodNullable<z.ZodDate>>;
};

type ManagedShape<Options extends SchemaOptions> = (Options['timestamps'] extends true
  ? TimestampShape
  : {}) &
  (Options['softdelete'] extends true ? SoftDeleteShape : {});

export type ManagedField<Options extends SchemaOptions> =
  | (Options['timestamps'] extends true ? 'createdAt' | 'updatedAt' : never)
  | (Options['softdelete'] extends true ? 'deletedAt' : never);

export type SoftDeleteEnabled<Options extends SchemaOptions> = Options['softdelete'] extends true
  ? true
  : false;

export const hasSoftDelete = (options: SchemaOptions): boolean => options.softdelete === true;

type ObjectIdFieldKeys<Shape extends SchemaShape> = {
  [Key in keyof InferShape<Schema<Shape>>]-?: NonNullable<
    InferShape<Schema<Shape>>[Key]
  > extends ObjectId
    ? Key
    : never;
}[keyof InferShape<Schema<Shape>>];

export type ScopeDefinitions = Record<string, readonly object[]>;

/** A typed, runtime-validated schema definition. */
export class Schema<
  Shape extends SchemaShape,
  Relations extends SchemaRelationMap = {},
  Scopes extends ScopeDefinitions = {},
  Options extends SchemaOptions = {},
> {
  /** The underlying Zod object for advanced validation use cases. */
  readonly definition: SchemaDefinition<Shape>;

  /** The lazily resolved relation metadata declared by this schema. */
  readonly refs: RelationMap<Shape>;

  /** One-way relation metadata declared for this schema. */
  readonly relationMap: Relations;

  /** Named population scopes declared for this schema. */
  scopeMap: Scopes;

  /** Field names excluded from default query results. */
  readonly hiddenFields: readonly (keyof Shape & string)[];

  /** Field names declared by this schema. */
  readonly fields: readonly (keyof Shape & string)[];

  /** Persistence behavior enabled for this schema. */
  readonly optionsConfig: Options;

  /** MongoDB indexes declared for this schema. */
  indexDefinitions: readonly SchemaIndex<Shape>[];

  /** Preserve schema options through registry type transformations. */
  declare readonly __options: Options;

  /** Construct a schema from a Zod object shape. */
  constructor(
    shape: Shape,
    relations = {} as Relations,
    scopeMap = {} as Scopes,
    optionsConfig = {} as Options,
    indexDefinitions = [] as readonly SchemaIndex<Shape>[],
  ) {
    this.definition = z.object(shape);
    this.refs = collectRefs(shape);
    this.relationMap = relations;
    this.scopeMap = scopeMap;
    this.fields = Object.keys(shape) as (keyof Shape & string)[];
    this.hiddenFields = this.fields.filter((field) => '__hidden' in shape[field]);
    this.optionsConfig = optionsConfig;
    this.indexDefinitions = indexDefinitions;
  }

  /** Enable managed timestamps and/or soft deletion for this schema. */
  options<const Enabled extends SchemaOptions>(
    options: Enabled,
  ): Schema<Shape & ManagedShape<Enabled>, Relations, Scopes, Enabled> {
    if (this.optionsConfig && Object.keys(this.optionsConfig).length > 0) {
      throw new Error('Schema options can only be configured once');
    }
    if (
      options.timestamps &&
      ('createdAt' in this.definition.shape || 'updatedAt' in this.definition.shape)
    ) {
      throw new Error('Timestamp fields createdAt and updatedAt are managed by Mongorm');
    }
    if (options.softdelete && 'deletedAt' in this.definition.shape) {
      throw new Error('The deletedAt field is managed by Mongorm');
    }

    const managedShape = {
      ...(options.timestamps
        ? {
            createdAt: z.date().default(() => new Date()),
            updatedAt: z.date().default(() => new Date()),
          }
        : {}),
      ...(options.softdelete ? { deletedAt: z.date().nullable().default(null) } : {}),
    } as ManagedShape<Enabled>;
    const next = new Schema(
      { ...this.definition.shape, ...managedShape } as Shape & ManagedShape<Enabled>,
      this.relationMap,
      this.scopeMap,
      options,
      this.indexDefinitions,
    );
    return next as unknown as Schema<Shape & ManagedShape<Enabled>, Relations, Scopes, Enabled>;
  }

  /** Declare MongoDB indexes for explicit synchronization with the database. */
  indexes<const Definitions extends readonly SchemaIndex<Shape>[]>(definitions: Definitions): this {
    this.indexDefinitions = definitions;
    return this;
  }

  /** Add one or more one-way relations without requiring circular schema declarations. */
  relations<
    const Definitions extends Partial<
      Record<Extract<ObjectIdFieldKeys<Shape>, string>, RelationInput>
    >,
  >(
    definitions: Definitions &
      Record<Exclude<keyof Definitions, Extract<ObjectIdFieldKeys<Shape>, string>>, never>,
  ): Schema<
    Shape,
    Relations & {
      [Name in keyof Definitions]: SchemaRelation<
        RelationInputTarget<NonNullable<Definitions[Name]>>,
        Extract<Name, string>,
        NonNullable<Definitions[Name]> extends { foreignField: infer Foreign extends string }
          ? Foreign
          : '_id'
      >;
    },
    Scopes,
    Options
  > {
    for (const [name, input] of Object.entries(definitions)) {
      const definition = (typeof input === 'function' ? { target: input } : input) as {
        target: () => SchemaLike;
        foreignField?: string;
      };
      (this.relationMap as SchemaRelationMap)[name] = {
        resolve: definition.target,
        localField: name,
        foreignField: definition.foreignField ?? '_id',
      };
    }
    return this as unknown as Schema<
      Shape,
      Relations & {
        [Name in keyof Definitions]: SchemaRelation<
          RelationInputTarget<NonNullable<Definitions[Name]>>,
          Extract<Name, string>,
          NonNullable<Definitions[Name]> extends { foreignField: infer Foreign extends string }
            ? Foreign
            : '_id'
        >;
      },
      Scopes,
      Options
    >;
  }

  /** Declare named, reusable population scopes. */
  scopes<const Definitions extends Record<string, PopulateSpecs<Relations>>>(
    definitions: Definitions,
  ): Schema<Shape, Relations, Definitions, Options> {
    this.scopeMap = definitions as unknown as Scopes;
    return this as unknown as Schema<Shape, Relations, Definitions, Options>;
  }

  /** Parse unknown input and return the inferred document type. */
  parse(input: unknown): InferShape<this> {
    return this.definition.parse(input) as InferShape<this>;
  }

  /** Parse a partial document for update operations. */
  parsePartial(input: unknown): Partial<InferShape<this>> {
    return this.definition.partial().parse(input) as Partial<InferShape<this>>;
  }

  /** Parse unknown input without throwing on validation failure. */
  safeParse(input: unknown): ReturnType<typeof this.definition.safeParse> {
    return this.definition.safeParse(input);
  }
}
