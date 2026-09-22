import { ObjectId } from 'mongodb';
import { z } from 'zod';

/** A schema field that can be marked as hidden from default query results. */
export type HiddenCapable<T extends z.ZodType> = T & {
  hidden(): HiddenSchema<T>;
};

/** A schema field marked as hidden from default query results. */
export type HiddenSchema<T extends z.ZodType> = T & {
  readonly __hidden: true;
  hidden(): HiddenSchema<T>;
};

const withHidden = <T extends z.ZodType>(schema: T): HiddenCapable<T> => {
  Object.defineProperty(schema, 'hidden', {
    configurable: false,
    enumerable: false,
    value: () => {
      Object.defineProperty(schema, '__hidden', {
        configurable: false,
        enumerable: false,
        value: true,
      });
      return schema;
    },
  });
  return schema as HiddenCapable<T>;
};

/** Create a string schema. */
export const string = () => withHidden(z.string());

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
