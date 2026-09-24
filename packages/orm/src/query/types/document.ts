import type { Document, ObjectId } from 'mongodb';
import type { z } from 'zod';

import type { SchemaDefinition, SchemaShape } from '../../schema/contracts.js';
import type { ModelCursor } from '../cursor/cursor.js';

/** Persisted data inferred from a schema, including MongoDB's generated identifier. */
export type ModelDocument<Shape extends SchemaShape> = z.output<SchemaDefinition<Shape>> & {
  _id: ObjectId;
};

/** Document type passed to MongoDB's collection APIs. */
export type StoredDocument<Shape extends SchemaShape> = ModelDocument<Shape> & Document;

export type HiddenKey<Shape extends SchemaShape> = {
  [Key in keyof Shape]: Shape[Key] extends { readonly __hidden: true } ? Key : never;
}[keyof Shape];

export type HiddenDocumentKey<Shape extends SchemaShape> = Extract<
  HiddenKey<Shape>,
  keyof ModelDocument<Shape>
> &
  string;

/** Fields exposed by an unprojected model query. */
export type VisibleDocument<Shape extends SchemaShape> = Omit<
  ModelDocument<Shape>,
  Extract<HiddenKey<Shape>, keyof ModelDocument<Shape>>
>;

export type CursorMethod<
  Shape extends SchemaShape,
  Result extends object,
  Ready extends boolean,
> = Ready extends true ? (after?: ObjectId) => ModelCursor<Shape, Result> : undefined;
