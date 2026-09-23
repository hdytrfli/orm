import type { ObjectId } from 'mongodb';
import type { z } from 'zod';

import type { SchemaShape } from './contracts.js';
import type { Schema } from './schema.js';

/** The raw parsed shape produced by a schema before persistence fields are added. */
export type InferShape<T> = T extends { definition: infer Definition extends z.ZodType }
  ? z.infer<Definition>
  : never;

/** The persisted document type inferred from a schema. */
export type Infer<T> = InferShape<T> & {
  _id: ObjectId;
};
