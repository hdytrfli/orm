import type { IndexDescription, IndexDirection, ObjectId } from 'mongodb';
import { z } from 'zod';

import type { PopulateSpecs } from '../query/query.js';
import type { ModelFilter } from '../query/types.js';
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
import { withHidden, type HiddenSchema } from './scalars.js';

/** Built-in persistence behavior applied by a schema. */
export interface SchemaOptions {
  readonly timestamps?: boolean;
  readonly softdelete?: boolean;
  /** Hide Mongorm-managed fields from default query results. */
  readonly hideManaged?: boolean;
}

type IndexFieldMap<Shape extends SchemaShape> = Record<
  Extract<keyof Shape, string>,
  IndexDirection
>;

/** A non-empty, autocomplete-friendly MongoDB index key definition. */
export type SchemaIndexFields<Shape extends SchemaShape> = {
  [Key in keyof IndexFieldMap<Shape>]: Pick<IndexFieldMap<Shape>, Key> &
    Partial<Omit<IndexFieldMap<Shape>, Key>>;
}[keyof IndexFieldMap<Shape>];

/** A schema-aware MongoDB partial-index filter. */
export type SchemaPartialFilter<Shape extends SchemaShape> = ModelFilter<Shape>;

export type SchemaIndexOptions<Shape extends SchemaShape> = Omit<
  IndexDescription,
  'key' | 'partialFilterExpression'
> & {
  /** Restrict indexed documents using schema-aware MongoDB filter operators. */
  readonly partialFilterExpression?: SchemaPartialFilter<Shape>;
};

export type SchemaIndex<Shape extends SchemaShape> = {
  readonly fields: SchemaIndexFields<Shape>;
  readonly options?: SchemaIndexOptions<Shape>;
};

type ExactPartialFilter<Shape extends SchemaShape, Filter> = Filter &
  Record<Exclude<keyof Filter, keyof SchemaPartialFilter<Shape>>, never>;

type ValidateIndexDefinition<Shape extends SchemaShape, Definition> = Definition extends {
  readonly options?: infer Options;
}
  ? Definition & {
      readonly options?: Options extends {
        readonly partialFilterExpression?: infer Filter;
      }
        ? Options & {
            readonly partialFilterExpression?: ExactPartialFilter<Shape, Filter>;
          }
        : Options;
    }
  : Definition;

type ValidateIndexDefinitions<Shape extends SchemaShape, Definitions extends readonly unknown[]> = {
  [Key in keyof Definitions]: ValidateIndexDefinition<Shape, Definitions[Key]>;
};

export type SchemaIndexNames<Indexes extends readonly SchemaIndex<any>[]> = Extract<
  Indexes[number] extends infer Index
    ? Index extends { readonly options?: { readonly name?: infer Name } }
      ? Name
      : never
    : never,
  string
>;

type ManagedSchema<
  T extends z.ZodType,
  Options extends SchemaOptions,
> = Options['hideManaged'] extends true ? HiddenSchema<T> : T;

type TimestampShape<Options extends SchemaOptions> = {
  createdAt: ManagedSchema<z.ZodDefault<z.ZodDate>, Options>;
  updatedAt: ManagedSchema<z.ZodDefault<z.ZodDate>, Options>;
};

type SoftDeleteShape<Options extends SchemaOptions> = {
  deletedAt: ManagedSchema<z.ZodDefault<z.ZodNullable<z.ZodDate>>, Options>;
};

type ManagedShape<Options extends SchemaOptions> = (Options['timestamps'] extends true
  ? TimestampShape<Options>
  : {}) &
  (Options['softdelete'] extends true ? SoftDeleteShape<Options> : {});

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
  Indexes extends readonly SchemaIndex<any>[] = [],
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
  indexDefinitions: readonly SchemaIndex<any>[];

  /** Preserve schema options through registry type transformations. */
  declare readonly __options: Options;

  /** Construct a schema from a Zod object shape. */
  constructor(
    shape: Shape,
    relations = {} as Relations,
    scopeMap = {} as Scopes,
    optionsConfig = {} as Options,
    indexDefinitions = [] as unknown as Indexes,
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
  ): Schema<Shape & ManagedShape<Enabled>, Relations, Scopes, Enabled, Indexes> {
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
            createdAt: this.managedField(
              z.date().default(() => new Date()),
              options,
            ),
            updatedAt: this.managedField(
              z.date().default(() => new Date()),
              options,
            ),
          }
        : {}),
      ...(options.softdelete
        ? { deletedAt: this.managedField(z.date().nullable().default(null), options) }
        : {}),
    } as ManagedShape<Enabled>;
    const next = new Schema(
      { ...this.definition.shape, ...managedShape } as Shape & ManagedShape<Enabled>,
      this.relationMap,
      this.scopeMap,
      options,
      this.indexDefinitions as unknown as readonly SchemaIndex<Shape & ManagedShape<Enabled>>[],
    );
    return next as unknown as Schema<
      Shape & ManagedShape<Enabled>,
      Relations,
      Scopes,
      Enabled,
      Indexes
    >;
  }

  private managedField<T extends z.ZodType>(field: T, options: SchemaOptions): T {
    return (options.hideManaged ? withHidden(field).hidden() : field) as T;
  }

  /** Declare MongoDB indexes for explicit synchronization with the database. */
  indexes<const Definitions extends readonly SchemaIndex<Shape>[]>(
    definitions: readonly SchemaIndex<Shape>[] & ValidateIndexDefinitions<Shape, Definitions>,
  ): Schema<Shape, Relations, Scopes, Options, Definitions> {
    if (definitions.some(({ fields }) => Object.keys(fields).length === 0)) {
      throw new Error('Index definitions must include at least one field');
    }
    this.indexDefinitions = definitions as unknown as Indexes;
    return this as unknown as Schema<Shape, Relations, Scopes, Options, Definitions>;
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
