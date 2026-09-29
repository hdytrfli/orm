import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { withHidden } from './hidden.js';

/** Create a hidden-capable MongoDB ObjectId schema. */
export const objectId = () => withHidden(z.instanceof(ObjectId));

/** Create an ObjectId schema that also accepts valid hexadecimal request strings. */
export const coerceObjectId = () =>
  z.union([
    z.instanceof(ObjectId),
    z
      .string()
      .refine((value) => {
        try {
          ObjectId.createFromHexString(value);
          return true;
        } catch {
          return false;
        }
      }, 'Invalid ObjectId hex string')
      .transform((value) => ObjectId.createFromHexString(value)),
  ]);
