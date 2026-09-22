import { ObjectId } from 'mongodb';
import { z } from 'zod';

/** Create a string schema. */
export const string = () => z.string();

/** Create a number schema. */
export const number = () => z.number();

/** Create a boolean schema. */
export const boolean = () => z.boolean();

/** Create a date schema. */
export const date = () => z.date();

/** Create a MongoDB ObjectId schema. */
export const objectId = () => z.instanceof(ObjectId);

/** Create a string enum schema while preserving literal members. */
export const enumeration = <const Values extends readonly [string, ...string[]]>(values: Values) =>
  z.enum(values);
