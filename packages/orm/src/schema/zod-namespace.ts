import { z } from 'zod';

import { withHidden } from './hidden.js';

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
