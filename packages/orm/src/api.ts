import { z } from 'zod';

import { createRef } from './relations/definitions.js';
import type { RefField, SchemaLike } from './relations/definitions.js';
import { createSchemaRegistry } from './relations/registry.js';
import type { SchemaShape } from './schema/contracts.js';
import { objectId, withZodNamespace } from './schema/scalars.js';
import { Schema } from './schema/schema.js';

type ZodConstructorKey = {
  [Key in keyof typeof z]: Key extends string
    ? Key extends Lowercase<Key>
      ? (typeof z)[Key] extends (...args: any[]) => any
        ? Key
        : never
      : never
    : never;
}[keyof typeof z];
type ZodConstructors = Pick<typeof z, ZodConstructorKey>;

/** The public schema-construction API. */
export type OrmApi = ZodConstructors & {
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
const zodConstructors = Object.fromEntries(
  Object.entries(z).filter(
    ([name, value]) => name === name.toLowerCase() && typeof value === 'function',
  ),
) as ZodConstructors;

export const orm: OrmApi = Object.assign({}, withZodNamespace(zodConstructors), {
  schema: <Shape extends SchemaShape>(shape: Shape) => new Schema(shape),
  defineSchemas: createSchemaRegistry,
  objectId,
  ref: createRef,
});
