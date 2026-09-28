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

/** A Zod type extended with Mongorm's hidden-field behavior. */
export type MongormZodType<T extends z.ZodType> = Omit<T, 'optional' | 'nullable' | 'nullish'> &
  HiddenMethods<T>;

/** A schema field marked as hidden from default query results. */
export type HiddenSchema<T extends z.ZodType> = Omit<T, 'optional' | 'nullable' | 'nullish'> &
  HiddenMethods<T> & {
    readonly __hidden: true;
  };

type HiddenMethods<T extends z.ZodType> = {
  hidden(): HiddenSchema<T>;
  optional(): MongormZodType<z.ZodOptional<T>>;
  nullable(): MongormZodType<z.ZodNullable<T>>;
  nullish(): MongormZodType<z.ZodOptional<z.ZodNullable<T>>>;
};

/** Add hidden-field metadata and preserve it through Zod wrappers. */
export const withHidden = <T extends z.ZodType>(schema: T): MongormZodType<T> =>
  new Proxy(schema, {
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
  }) as unknown as MongormZodType<T>;
