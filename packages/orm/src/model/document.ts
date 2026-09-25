import { ObjectId } from 'mongodb';

import { hasSoftDelete, type SchemaOptions } from '../schema/index.js';

/** Minimum schema contract needed to prepare a persisted document. */
export interface DocumentSchema {
  readonly optionsConfig: SchemaOptions;
  parse(input: unknown): unknown;
}

/** Parse a create payload and add the model-managed persistence fields. */
export const prepareDocument = (
  schema: DocumentSchema,
  input: unknown,
  generateId = true,
): Record<string, unknown> => {
  const now = new Date();
  const document: Record<string, unknown> = {
    ...(generateId ? { _id: new ObjectId() } : {}),
    ...(schema.parse(input) as Record<string, unknown>),
  };

  if (schema.optionsConfig.timestamps) {
    document.createdAt = now;
    document.updatedAt = now;
  }
  if (hasSoftDelete(schema.optionsConfig)) document.deletedAt = null;

  return document;
};
