import type { SchemaShape } from './schema/contracts.js';
import { createSchemaRegistry } from './schema/registry.js';
import { createRef } from './schema/relations.js';
import type { RefField, SchemaLike } from './schema/relations.js';
import { boolean, date, enumeration, number, objectId, string } from './schema/scalars.js';
import { Schema } from './schema/schema.js';

/** The public schema-construction API. */
export interface OrmApi {
  /** Define a typed object schema. */
  schema<Shape extends SchemaShape>(shape: Shape): Schema<Shape>;
  /** Build a registry of named schemas and their relation graph. */
  schemas<const Registry extends Record<string, SchemaLike>>(
    registry: Registry,
  ): ReturnType<typeof createSchemaRegistry<Registry>>;
  /** Create a string field. */
  string: typeof string;
  /** Create a number field. */
  number: typeof number;
  /** Create a boolean field. */
  boolean: typeof boolean;
  /** Create a date field. */
  date: typeof date;
  /** Create a MongoDB ObjectId field. */
  objectId: typeof objectId;
  /** Create a string enum field. */
  enum: typeof enumeration;
  /** Create a string ID field linked to another schema. */
  ref<Target extends SchemaLike>(resolve: () => Target): RefField<Target>;
}

/** The ORM schema API. */
export const orm: OrmApi = {
  schema: <Shape extends SchemaShape>(shape: Shape) => new Schema(shape),
  schemas: createSchemaRegistry,
  string,
  number,
  boolean,
  date,
  objectId,
  enum: enumeration,
  ref: createRef,
};
