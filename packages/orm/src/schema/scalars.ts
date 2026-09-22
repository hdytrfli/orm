import { ObjectId } from 'mongodb';
import { z } from 'zod';

declare module 'zod' {
  interface ZodType {
    hidden(): this & { readonly __hidden: true };
  }
}

if (!Object.prototype.hasOwnProperty.call(z.ZodType.prototype, 'hidden')) {
  Object.defineProperty(z.ZodType.prototype, 'hidden', {
    configurable: false,
    enumerable: false,
    value(this: z.ZodType) {
      Object.defineProperty(this, '__hidden', {
        configurable: false,
        enumerable: false,
        value: true,
      });
      return this;
    },
  });
}

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

export const withHidden = <T extends z.ZodType>(schema: T): HiddenCapable<T> => {
  return new Proxy(schema, {
    get(target, property, receiver) {
      if (property === 'hidden') {
        return () => {
          Object.defineProperty(target, '__hidden', {
            configurable: false,
            enumerable: false,
            value: true,
          });
          return receiver;
        };
      }
      const value = Reflect.get(target, property, receiver);
      if (typeof value !== 'function') return value;
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        return result instanceof z.ZodType ? withHidden(result) : result;
      };
    },
  }) as unknown as HiddenCapable<T>;
};

/** Wrap native Zod constructors so returned schemas support `.hidden()`. */
export const withZodNamespace = <T extends object>(namespace: T): T =>
  new Proxy(namespace, {
    get(target, property, receiver) {
      const value = Reflect.get(target, property, receiver);
      if (
        typeof value !== 'function' ||
        String(property)[0] !== String(property)[0].toLowerCase()
      ) {
        return value;
      }
      return (...args: unknown[]) => {
        const result = value.apply(target, args);
        return result instanceof z.ZodType ? withHidden(result) : result;
      };
    },
  });

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
