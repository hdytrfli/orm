import type { ObjectId } from 'mongodb';
import type { z } from 'zod';

/** The raw parsed shape produced by a schema before persistence fields are added. */
export type InferShape<T> = T extends { definition: infer Definition extends z.ZodType }
  ? z.infer<Definition>
  : never;

/** The input type accepted by a schema before Zod defaults are applied. */
export type InferInput<T> = T extends { definition: infer Definition extends z.ZodType }
  ? z.input<Definition>
  : never;

/** The persisted document type inferred from a schema. */
export type Infer<T> = InferShape<T> & {
  _id: ObjectId;
};
