import { z } from 'zod';

import type {
  SchemaRelationMap,
  SchemaVirtualMap,
  SchemaVirtualDeclarations,
} from '../relations/definitions.js';
import { SchemaConfigurationError } from '../validation/errors.js';
import { coerceSchemaShape, type CoercedSchemaShape } from './coercion.js';
import type { SchemaDefinition, SchemaShape, ScopeDefinitions } from './contracts.js';
import type { SchemaIndex, ValidateIndexDefinitions } from './indexes.js';
import type { InferShape } from './inference.js';
import { managedField } from './options.js';
import type { ManagedShape, SchemaOptions } from './options.js';

/** A typed, runtime-validated schema definition. */
export class Schema<
  Shape extends SchemaShape,
  Relations extends SchemaRelationMap = {},
  Scopes extends ScopeDefinitions = {},
  Options extends SchemaOptions = {},
  Indexes extends readonly SchemaIndex<any>[] = [],
  Virtuals extends SchemaVirtualDeclarations | SchemaVirtualMap = {},
> {
  declare readonly __shape: Shape;
  declare readonly __relations: Relations;
  declare readonly __scopes: Scopes;
  declare readonly __indexes: Indexes;
  declare readonly __virtuals: Virtuals;

  /** The underlying Zod object for advanced validation use cases. */
  readonly definition: SchemaDefinition<Shape>;
  /** A transport-input parser that coerces common string representations before strict validation. */
  readonly coerced: z.ZodObject<CoercedSchemaShape<Shape>>;
  private partialDefinition: { parse(input: unknown): unknown } | undefined;

  /** One-way relation metadata declared for this schema. */
  readonly relationMap: Relations;

  /** Reverse/virtual relation metadata declared for this schema. */
  readonly virtualMap: Virtuals extends SchemaVirtualMap ? Virtuals : {};

  /** Schema-level virtual kinds, retained separately from resolved bindings. */
  readonly virtualDefinitions: SchemaVirtualDeclarations;

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

  /** Registry-configured searchable string field paths. */
  searchableFields: readonly string[] = [];

  /** Preserve schema options through registry type transformations. */
  declare readonly __options: Options;

  /** Construct a schema from a Zod object shape. */
  constructor(
    shape: Shape,
    relations = {} as Relations,
    scopeMap = {} as Scopes,
    optionsConfig = {} as Options,
    indexDefinitions = [] as unknown as Indexes,
    virtualMap = {} as SchemaVirtualMap,
    virtualDefinitions = {} as SchemaVirtualDeclarations,
  ) {
    this.definition = z.object(shape);
    this.coerced = z.object(coerceSchemaShape(shape));
    this.relationMap = relations;
    this.virtualMap = virtualMap as Virtuals extends SchemaVirtualMap ? Virtuals : {};
    this.virtualDefinitions = virtualDefinitions;
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
  ): Schema<Shape & ManagedShape<Enabled>, Relations, Scopes, Enabled, Indexes, Virtuals> {
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
    if (
      options.collection !== undefined &&
      (!options.collection.trim() || options.collection.includes('\0'))
    ) {
      throw new SchemaConfigurationError('collection must be a non-empty MongoDB collection name.');
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
      this.virtualMap,
      this.virtualDefinitions,
    );
    next.searchableFields = this.searchableFields;
    return next as unknown as Schema<
      Shape & ManagedShape<Enabled>,
      Relations,
      Scopes,
      Enabled,
      Indexes,
      Virtuals
    >;
  }

  /** Declare MongoDB indexes for explicit synchronization with the database. */
  indexes<const Definitions extends readonly SchemaIndex<Shape>[]>(
    definitions: readonly SchemaIndex<Shape>[] & ValidateIndexDefinitions<Shape, Definitions>,
  ): Schema<Shape, Relations, Scopes, Options, Definitions, Virtuals> {
    for (const definition of definitions) {
      if (Object.keys(definition.fields).length === 0) {
        throw new SchemaConfigurationError(
          'Index definitions must include at least one field in fields.',
        );
      }
    }
    this.indexDefinitions = definitions as unknown as Indexes;
    return this as unknown as Schema<Shape, Relations, Scopes, Options, Definitions, Virtuals>;
  }

  /** Parse unknown input and return the inferred document type. */
  parse(input: unknown): InferShape<this> {
    return this.definition.parse(input) as InferShape<this>;
  }

  /** Parse a partial document for update operations. */
  parsePartial(input: unknown): Partial<InferShape<this>> {
    let definition = this.partialDefinition;
    if (!definition) {
      definition = this.definition.partial();
      this.partialDefinition = definition;
    }
    return definition.parse(input) as Partial<InferShape<this>>;
  }

  /** Parse unknown input without throwing on validation failure. */
  safeParse(input: unknown): ReturnType<typeof this.definition.safeParse> {
    return this.definition.safeParse(input);
  }
}
