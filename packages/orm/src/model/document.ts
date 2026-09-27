import { ObjectId } from 'mongodb';

import { hasSoftDelete, type SchemaOptions } from '../schema/index.js';

/** Minimum schema contract needed to prepare a persisted document. */
export interface DocumentSchema {
  readonly optionsConfig: SchemaOptions;
  parse(input: unknown): unknown;
}

interface UpdatableDocumentSchema extends DocumentSchema {
  parsePartial(input: unknown): unknown;
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

const MANAGED_FIELDS = ['createdAt', 'updatedAt', 'deletedAt'] as const;

/** Parse an update payload and apply Mongorm's managed-field rules. */
export const prepareUpdatePatch = (
  schema: UpdatableDocumentSchema,
  input: unknown,
): Record<string, unknown> => {
  const patch = schema.parsePartial(input) as Record<string, unknown>;
  for (const field of MANAGED_FIELDS) delete patch[field];
  if (schema.optionsConfig.timestamps) patch.updatedAt = new Date();
  return patch;
};

/** Create a soft-delete or restore patch and advance managed timestamps when enabled. */
export const prepareSoftDeletePatch = (
  schema: DocumentSchema,
  deletedAt: Date | null,
): Record<string, unknown> => ({
  deletedAt,
  ...(schema.optionsConfig.timestamps ? { updatedAt: new Date() } : {}),
});

/** Separate insert-only fields from equality fields when preparing an upsert. */
export const splitUpsertDocument = (
  schema: DocumentSchema,
  document: Record<string, unknown>,
  equalityFields: Record<string, unknown>,
): { set: Record<string, unknown>; setOnInsert: Record<string, unknown> } => {
  const setOnInsert: Record<string, unknown> = {};
  if (schema.optionsConfig.timestamps) {
    setOnInsert.createdAt = document.createdAt;
    delete document.createdAt;
  }
  if (hasSoftDelete(schema.optionsConfig)) {
    setOnInsert.deletedAt = document.deletedAt;
    delete document.deletedAt;
  }
  for (const field of Object.keys(equalityFields)) delete document[field];

  return { set: document, setOnInsert };
};
