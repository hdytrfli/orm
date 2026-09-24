import { type Filter, type ObjectId } from 'mongodb';

import type { SchemaShape } from '../../schema/contracts.js';
import type { ModelFilter, StoredDocument } from '../types.js';

/** Add the `_id` continuation boundary used by cursor pagination. */
export const createCursorFilter = <Shape extends SchemaShape>(
  filter: ModelFilter<Shape>,
  after?: ObjectId,
): ModelFilter<Shape> =>
  (after ? { $and: [filter, { _id: { $gt: after } }] } : filter) as ModelFilter<Shape>;

export type QueryCollection<Shape extends SchemaShape> = import('mongodb').Collection<
  StoredDocument<Shape>
>;
export type MongoQueryFilter<Shape extends SchemaShape> = Filter<StoredDocument<Shape>>;
