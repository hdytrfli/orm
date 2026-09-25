import type { ObjectId } from 'mongodb';
import { z } from 'zod';

import type { PopulateSpecs } from '../query/index.js';
import type {
  RelationInput,
  RelationInputTarget,
  SchemaRelation,
  SchemaRelationMap,
  SchemaLike,
} from '../relations/definitions.js';
import { SchemaConfigurationError } from '../validation/errors.js';
import type { SchemaDefinition, SchemaShape, ScopeDefinitions } from './contracts.js';
import type { SchemaIndex, ValidateIndexDefinitions } from './indexes.js';
import type { InferShape } from './inference.js';
import { managedField } from './options.js';
import type { ManagedShape, SchemaOptions } from './options.js';

type ObjectIdFieldKeys<Shape extends SchemaShape> = {
  [Key in keyof InferShape<Schema<Shape>>]-?: NonNullable<
    InferShape<Schema<Shape>>[Key]
  > extends ObjectId
    ? Key
    : never;
}[keyof InferShape<Schema<Shape>>];

type RelationsFromDefinitions<Definitions extends Partial<Record<string, RelationInput>>> = {
  [Name in keyof Definitions]: SchemaRelation<
    RelationInputTarget<NonNullable<Definitions[Name]>>,
    Extract<Name, string>,
    NonNullable<Definitions[Name]> extends { foreignField: infer Foreign extends string }
      ? Foreign
      : '_id'
  >;
};

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
    this.relationMap = relations;
    this.scopeMap = scopeMap;
    const fields = Object.keys(shape) as (keyof Shape & string)[];
    const hiddenFields: (keyof Shape & string)[] = [];
    for (const field of fields) {
      if ('__hidden' in shape[field]) hiddenFields.push(field);
    }
    this.fields = fields;
    this.hiddenFields = hiddenFields;
    this.optionsConfig = optionsConfig;
    this.indexDefinitions = indexDefinitions;
  }

  /** Enable managed timestamps and/or soft deletion for this schema. */
  options<const Enabled extends SchemaOptions>(
    options: Enabled,
  ): Schema<Shape & ManagedShape<Enabled>, Relations, Scopes, Enabled, Indexes> {
    if (Object.keys(this.optionsConfig).length > 0) {
      throw new SchemaConfigurationError(
        'Schema options are already configured. Combine all options in one .options({...}) call.',
      );
    }
    const hasTimestampCollision =
      'createdAt' in this.definition.shape || 'updatedAt' in this.definition.shape;
    if (options.timestamps && hasTimestampCollision) {
      throw new SchemaConfigurationError(
        'Fields createdAt and updatedAt are managed by Mongorm when timestamps are enabled; omit them from the schema shape.',
      );
    }
    if (options.softdelete && 'deletedAt' in this.definition.shape) {
      throw new SchemaConfigurationError(
        'Field deletedAt is managed by Mongorm when softdelete is enabled; omit it from the schema shape.',
      );
    }

    const managedShape = {
      ...(options.timestamps
        ? {
            createdAt: managedField(
              z.date().default(() => new Date()),
              options,
            ),
            updatedAt: managedField(
              z.date().default(() => new Date()),
              options,
            ),
          }
        : {}),
      ...(options.softdelete
        ? { deletedAt: managedField(z.date().nullable().default(null), options) }
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

  /** Declare MongoDB indexes for explicit synchronization with the database. */
  indexes<const Definitions extends readonly SchemaIndex<Shape>[]>(
    definitions: readonly SchemaIndex<Shape>[] & ValidateIndexDefinitions<Shape, Definitions>,
  ): Schema<Shape, Relations, Scopes, Options, Definitions> {
    for (const definition of definitions) {
      if (Object.keys(definition.fields).length === 0) {
        throw new SchemaConfigurationError(
          'Index definitions must include at least one field in fields.',
        );
      }
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
  ): Schema<Shape, Relations & RelationsFromDefinitions<Definitions>, Scopes, Options> {
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
      Relations & RelationsFromDefinitions<Definitions>,
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
