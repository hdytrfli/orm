import { ObjectId } from 'mongodb';
import { z } from 'zod';

/** A schema field that can be marked as hidden from default query results. */
export type HiddenCapable<T extends z.ZodType> = Omit<T, 'optional' | 'nullable' | 'nullish'> &
  HiddenMethods<T>;

/** A schema field marked as hidden from default query results. */
export type HiddenSchema<T extends z.ZodType> = Omit<T, 'optional' | 'nullable' | 'nullish'> &
  HiddenMethods<T> & {
    readonly __hidden: true;
  };

type HiddenMethods<T extends z.ZodType> = {
  hidden(): HiddenSchema<T>;
  optional(): HiddenCapable<z.ZodOptional<T>>;
  nullable(): HiddenCapable<z.ZodNullable<T>>;
  nullish(): HiddenCapable<z.ZodOptional<z.ZodNullable<T>>>;
};

const withHidden = <T extends z.ZodType>(schema: T): HiddenCapable<T> => {
  const optional = schema.optional.bind(schema);
  const nullable = schema.nullable.bind(schema);
  const nullish = schema.nullish.bind(schema);
  const wrap = <Wrapped extends z.ZodType>(result: Wrapped): HiddenCapable<Wrapped> => {
    const wrapped = withHidden(result);
    if ('__hidden' in schema) wrapped.hidden();
    return wrapped;
  };
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
  Object.defineProperty(schema, 'optional', {
    configurable: false,
    enumerable: false,
    value: () => wrap(optional()),
  });
  Object.defineProperty(schema, 'nullable', {
    configurable: false,
    enumerable: false,
    value: () => wrap(nullable()),
  });
  Object.defineProperty(schema, 'nullish', {
    configurable: false,
    enumerable: false,
    value: () => wrap(nullish()),
  });
  return schema as unknown as HiddenCapable<T>;
};

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
