import { type ObjectId } from 'mongodb';

import type { SchemaShape } from '../../schema/contracts.js';
import type { ModelFilter } from '../types.js';

/** Add the `_id` continuation boundary used by cursor pagination. */
export const createCursorFilter = <Shape extends SchemaShape>(
  filter: ModelFilter<Shape>,
  after?: ObjectId,
): ModelFilter<Shape> =>
  (after ? { $and: [filter, { _id: { $gt: after } }] } : filter) as ModelFilter<Shape>;
