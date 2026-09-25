import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { withHidden } from './hidden.js';

/** Create a string schema. */
export const string = () => withHidden(z.string());

/** Create an email schema. */
export const email = () => withHidden(z.email());

/** Create a URL schema. */
export const url = () => withHidden(z.url());

/** Create a number schema. */
export const number = () => withHidden(z.number());

/** Create a boolean schema. */
export const boolean = () => withHidden(z.boolean());

/** Create a date schema. */
export const date = () => withHidden(z.date());

/** Create a MongoDB ObjectId schema. */
export const objectId = () => withHidden(z.instanceof(ObjectId));

/** Create a nested object schema. */
export const object = <const Shape extends z.ZodRawShape>(shape: Shape) =>
  withHidden(z.object(shape));

/** Create a string enum schema while preserving literal members. */
export const enumeration = <const Values extends readonly [string, ...string[]]>(values: Values) =>
  withHidden(z.enum(values));
