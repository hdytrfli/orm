import type { SchemaShape } from './schema/contracts.js';
import { boolean, date, enumeration, number, string } from './schema/scalars.js';
import { Schema } from './schema/schema.js';

/** The public schema-construction API. */
export interface OrmApi {
  /** Define a typed object schema. */
  schema<Shape extends SchemaShape>(shape: Shape): Schema<Shape>;
  /** Create a string field. */
  string: typeof string;
  /** Create a number field. */
  number: typeof number;
  /** Create a boolean field. */
  boolean: typeof boolean;
  /** Create a date field. */
  date: typeof date;
  /** Create a string enum field. */
  enum: typeof enumeration;
}

/** The ORM schema API. */
export const orm: OrmApi = {
  schema: <Shape extends SchemaShape>(shape: Shape) => new Schema(shape),
  string,
  number,
  boolean,
  date,
  enum: enumeration,
};
