import { z } from 'zod';

import type { SchemaShape } from './schema/contracts.js';
import { createSchemaRegistry } from './schema/registry.js';
import { createRef } from './schema/relations.js';
import type { RefField, SchemaLike } from './schema/relations.js';
import { objectId, withZodNamespace } from './schema/scalars.js';
import { Schema } from './schema/schema.js';

/** The public schema-construction API. */
export type OrmApi = typeof z & {
  /** Define a typed object schema. */
  schema<Shape extends SchemaShape>(shape: Shape): Schema<Shape>;
  /** Build a registry of named schemas and their relation graph. */
  defineSchemas<const Registry extends Record<string, SchemaLike>>(
    registry: Registry,
  ): ReturnType<typeof createSchemaRegistry<Registry>>;
  /** Create a MongoDB ObjectId field. */
  objectId: typeof objectId;
  /** Create a string ID field linked to another schema. */
  ref<Target extends SchemaLike>(resolve: () => Target): RefField<Target>;
};

/** The ORM schema API with the complete native Zod namespace. */
export const orm: OrmApi = Object.assign({}, withZodNamespace(z), {
  schema: <Shape extends SchemaShape>(shape: Shape) => new Schema(shape),
  defineSchemas: createSchemaRegistry,
  objectId,
  ref: createRef,
});
