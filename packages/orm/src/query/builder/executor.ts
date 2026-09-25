import { ObjectId, type Collection, type Filter as MongoFilter, type Sort } from 'mongodb';

import type { SchemaRelationMap, SchemaShape } from '../../schema/index.js';
import { CursorQueryError, EstimatedCountError } from '../../validation/errors.js';
import { MODEL_CURSOR_BATCH_SIZE, ModelCursor } from '../cursor/cursor.js';
import { createCursorFilter } from '../cursor/filter.js';
import { PopulationExecutor } from '../population/executor.js';
import { projectionFor } from '../projection/runtime.js';
import { SoftDeleteState } from '../soft-delete/state.js';
import type { ModelFilter, ModelSort, PopulateSpecs, StoredDocument } from '../types.js';

/** Runtime inputs needed to execute a fully configured model query. */
export interface QueryExecutionContext<
  Shape extends SchemaShape,
  Relations extends SchemaRelationMap,
> {
  collection: Collection<StoredDocument<Shape>>;
  filter: ModelFilter<Shape>;
  effectiveFilter: ModelFilter<Shape>;
  fields: readonly string[];
  hiddenFields: readonly string[];
  selectedFields: readonly string[] | undefined;
  shownFields: readonly string[];
  sortSpec: ModelSort<Shape> | undefined;
  skipCount: number | undefined;
  limitCount: number | undefined;
  softDelete: SoftDeleteState<Shape>;
  population: PopulationExecutor<Relations>;
  populateSpecs: PopulateSpecs<Relations>;
}

/** Execute a list query or MongoDB's estimated collection count. */
export const countQuery = async <Shape extends SchemaShape, Relations extends SchemaRelationMap>(
  context: QueryExecutionContext<Shape, Relations>,
  estimate: boolean,
): Promise<number> => {
  if (!estimate) {
    return context.collection.countDocuments(
      context.effectiveFilter as MongoFilter<StoredDocument<Shape>>,
    );
  }

  const hasFilter = Object.keys(context.filter).length > 0;
  if (hasFilter || context.softDelete.isFiltered()) throw new EstimatedCountError();
  return context.collection.estimatedDocumentCount();
};

/** Open an `_id`-ordered cursor stream or one bounded cursor page. */
export const createCursorPage = <
  Shape extends SchemaShape,
  Result extends object,
  Relations extends SchemaRelationMap,
>(
  context: QueryExecutionContext<Shape, Relations>,
  after?: ObjectId,
): ModelCursor<Shape, Result> => {
  const pageSize = context.limitCount;
  if (pageSize === 0) {
    throw new CursorQueryError('Cursor queries require a positive limit');
  }
  if (context.skipCount !== undefined) {
    throw new CursorQueryError('Cursor queries do not support skip');
  }
  if (context.sortSpec) {
    const keys = Object.keys(context.sortSpec);
    if (keys.length !== 1 || context.sortSpec._id !== 'asc') {
      throw new CursorQueryError('Cursor queries require the default _id ascending sort');
    }
  }

  const filter = createCursorFilter(context.effectiveFilter, after);
  const openCursor = () => {
    let cursor = context.collection
      .find(filter as MongoFilter<StoredDocument<Shape>>)
      .sort({ _id: 1 });
    if (pageSize === undefined) cursor = cursor.batchSize(MODEL_CURSOR_BATCH_SIZE);
    else cursor = cursor.limit(pageSize + 1);
    const projection = projectionFor(
      context.fields,
      context.hiddenFields,
      context.selectedFields,
      context.shownFields,
    );
    if (projection) cursor = cursor.project(projection);
    return cursor;
  };
  const populateResults = (documents: Result[]) =>
    context.population.apply(documents, context.populateSpecs);

  return new ModelCursor(openCursor, pageSize, populateResults);
};

/** Execute a list query and populate its results. */
export const executeQuery = async <
  Shape extends SchemaShape,
  Result extends object,
  Relations extends SchemaRelationMap,
>(
  context: QueryExecutionContext<Shape, Relations>,
): Promise<Result[]> => {
  const documents = await createFindCursor(context).toArray();
  return context.population.apply(documents as unknown as Result[], context.populateSpecs);
};

/** Execute a query for its first matching document. */
export const executeFirst = async <
  Shape extends SchemaShape,
  Result extends object,
  Relations extends SchemaRelationMap,
>(
  context: QueryExecutionContext<Shape, Relations>,
): Promise<Result | null> => {
  const documents = await createFindCursor(context).limit(1).toArray();
  const results = documents as unknown as Result[];
  const populated = await context.population.apply(results, context.populateSpecs);
  return populated[0] ?? null;
};

const createFindCursor = <Shape extends SchemaShape, Relations extends SchemaRelationMap>(
  context: QueryExecutionContext<Shape, Relations>,
) => {
  let cursor = context.collection.find(
    context.effectiveFilter as MongoFilter<StoredDocument<Shape>>,
  );
  const sortSpec = context.sortSpec;
  if (sortSpec) cursor = cursor.sort(sortSpec as Sort);

  const skipCount = context.skipCount;
  if (skipCount !== undefined) cursor = cursor.skip(skipCount);

  const limitCount = context.limitCount;
  if (limitCount !== undefined) cursor = cursor.limit(limitCount);

  const projection = projectionFor(
    context.fields,
    context.hiddenFields,
    context.selectedFields,
    context.shownFields,
  );

  if (projection) cursor = cursor.project(projection);
  return cursor;
};
