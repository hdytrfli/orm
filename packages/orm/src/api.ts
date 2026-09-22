import type { SchemaShape } from './schema/contracts.js';
import { createSchemaRegistry } from './schema/registry.js';
import { createRef } from './schema/relations.js';
import type { RefField, SchemaLike } from './schema/relations.js';
import {
  boolean,
  date,
  email,
  enumeration,
  number,
  object,
  objectId,
  string,
  url,
} from './schema/scalars.js';
import { Schema } from './schema/schema.js';

/** The public schema-construction API. */
export interface OrmApi {
  /** Define a typed object schema. */
  schema<Shape extends SchemaShape>(shape: Shape): Schema<Shape>;
  /** Build a registry of named schemas and their relation graph. */
  defineSchemas<const Registry extends Record<string, SchemaLike>>(
    registry: Registry,
  ): ReturnType<typeof createSchemaRegistry<Registry>>;
  /** Create a string field. */
  string: typeof string;
  /** Create an email schema. */
  email: typeof email;
  /** Create a URL schema. */
  url: typeof url;
  /** Create a number field. */
  number: typeof number;
  /** Create a boolean field. */
  boolean: typeof boolean;
  /** Create a date field. */
  date: typeof date;
  /** Create a MongoDB ObjectId field. */
  objectId: typeof objectId;
  /** Create a nested object schema. */
  object: typeof object;
  /** Create a string enum field. */
  enum: typeof enumeration;
  /** Create a string ID field linked to another schema. */
  ref<Target extends SchemaLike>(resolve: () => Target): RefField<Target>;
}

/** The ORM schema API. */
export const orm: OrmApi = {
  schema: <Shape extends SchemaShape>(shape: Shape) => new Schema(shape),
  defineSchemas: createSchemaRegistry,
  string,
  email,
  url,
  number,
  boolean,
  date,
  objectId,
  object,
  enum: enumeration,
  ref: createRef,
};
