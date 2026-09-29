import {
  ObjectId,
  type Collection,
  type Document,
  type Filter as MongoFilter,
  type Sort,
} from 'mongodb';

import type { SchemaRelationMap, SchemaShape } from '../../schema/index.js';
import { CursorQueryError, EstimatedCountError } from '../../validation/errors.js';
import { MODEL_CURSOR_BATCH_SIZE, ModelCursor } from '../cursor/cursor.js';
import { createCursorFilter } from '../cursor/filter.js';
import { PopulationExecutor } from '../population/executor.js';
import type { RuntimePopulateSpec } from '../population/executor.js';
import { projectionFor } from '../projection/runtime.js';
import { SoftDeleteState } from '../soft-delete/state.js';
import type { ModelFilter, ModelSort, StoredDocument } from '../types.js';

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
  fieldSelection: readonly string[] | undefined;
  sortSpec: ModelSort<Shape> | undefined;
  skipCount: number | undefined;
  limitCount: number | undefined;
  softDelete: SoftDeleteState<Shape>;
  population: PopulationExecutor<Relations>;
  populateSpecs: readonly RuntimePopulateSpec[];
  searchableFields: readonly string[];
  searchTerm: string | undefined;
  searchRelations: readonly {
    relationPath: string;
    from: string;
    localField: string;
    foreignField: string;
    targetFields: readonly string[];
  }[];
}

/** Execute a list query or MongoDB's estimated collection count. */
export const countQuery = async <Shape extends SchemaShape, Relations extends SchemaRelationMap>(
  context: QueryExecutionContext<Shape, Relations>,
  estimate: boolean,
): Promise<number> => {
  if (estimate && context.searchTerm) throw new EstimatedCountError();
  if (
    context.searchTerm &&
    context.searchRelations.some((relation) => relation.targetFields.length)
  ) {
    if (estimate) throw new EstimatedCountError();
    const result = await context.collection
      .aggregate([...searchPipeline(context, false), { $count: 'count' }])
      .toArray();
    return (result[0] as { count?: number } | undefined)?.count ?? 0;
  }
  if (!estimate) {
    return context.collection.countDocuments(
      searchFilter(context) as MongoFilter<StoredDocument<Shape>>,
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
  if (context.searchTerm) throw new CursorQueryError('Cursor queries do not support search');
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
    const projection = projectionFor(context.fields, context.hiddenFields, context.fieldSelection);
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
  return executeFindResults<Shape, Result, Relations>(context);
};

/** Execute a query for its first matching document. */
export const executeFirst = async <
  Shape extends SchemaShape,
  Result extends object,
  Relations extends SchemaRelationMap,
>(
  context: QueryExecutionContext<Shape, Relations>,
): Promise<Result | null> => {
  const populated = await executeFindResults<Shape, Result, Relations>(context, 1);
  return populated[0] ?? null;
};

const executeFindResults = async <
  Shape extends SchemaShape,
  Result extends object,
  Relations extends SchemaRelationMap,
>(
  context: QueryExecutionContext<Shape, Relations>,
  limit?: number,
): Promise<Result[]> => {
  if (
    context.searchTerm &&
    context.searchRelations.some((relation) => relation.targetFields.length)
  ) {
    const pipeline = searchPipeline(context);
    if (limit !== undefined) pipeline.push({ $limit: limit });
    const projection = projectionFor(context.fields, context.hiddenFields, context.fieldSelection);
    if (projection) pipeline.push({ $project: projection });
    const documents = (await context.collection.aggregate<Result>(pipeline).toArray()) as Result[];
    return context.population.apply(documents, context.populateSpecs);
  }
  let cursor = createFindCursor(context);
  if (limit !== undefined) cursor = cursor.limit(limit);
  const documents = (await cursor.toArray()) as unknown as Result[];
  return context.population.apply(documents, context.populateSpecs);
};

const escapeRegex = (value: string): string => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const searchFilter = <Shape extends SchemaShape, Relations extends SchemaRelationMap>(
  context: QueryExecutionContext<Shape, Relations>,
): Document => {
  if (!context.searchTerm) return context.effectiveFilter as Document;
  const relatedPrefixes = context.searchRelations
    .filter((relation) => relation.targetFields.length)
    .map((relation) => `${relation.relationPath}.`);
  const localPaths = context.searchableFields.filter(
    (path) => !relatedPrefixes.some((prefix) => path.startsWith(prefix)),
  );
  return {
    $and: [
      context.effectiveFilter,
      {
        $or: localPaths.map((path) => ({
          [path]: { $regex: escapeRegex(context.searchTerm!), $options: 'i' },
        })),
      },
    ],
  };
};

const searchPipeline = <Shape extends SchemaShape, Relations extends SchemaRelationMap>(
  context: QueryExecutionContext<Shape, Relations>,
  paginate = true,
): Document[] => {
  const pipeline: Document[] = [{ $match: context.effectiveFilter }];
  const related = context.searchRelations.filter((relation) => relation.targetFields.length);
  for (const [index, relation] of related.entries()) {
    pipeline.push({
      $lookup: {
        from: relation.from,
        localField: relation.localField,
        foreignField: relation.foreignField,
        pipeline: [
          { $project: Object.fromEntries(relation.targetFields.map((field) => [field, 1])) },
        ],
        as: `__mongorm_search_${index}`,
      },
    });
  }
  const regex = { $regex: escapeRegex(context.searchTerm ?? ''), $options: 'i' };
  const clauses: Document[] = [];
  const prefixes = related.map((relation) => `${relation.relationPath}.`);
  for (const path of context.searchableFields) {
    if (!prefixes.some((prefix) => path.startsWith(prefix))) clauses.push({ [path]: regex });
  }
  for (const [index, relation] of related.entries()) {
    for (const targetField of relation.targetFields) {
      clauses.push({ [`__mongorm_search_${index}.${targetField}`]: regex });
    }
  }
  pipeline.push({ $match: { $or: clauses } });
  for (const [index] of related.entries()) pipeline.push({ $unset: `__mongorm_search_${index}` });
  if (paginate && context.sortSpec) {
    pipeline.push({
      $sort: Object.fromEntries(
        Object.entries(context.sortSpec).map(([field, direction]) => [
          field,
          direction === 'asc' ? 1 : -1,
        ]),
      ) as Sort,
    });
  }
  if (paginate && context.skipCount) pipeline.push({ $skip: context.skipCount });
  if (paginate && context.limitCount !== undefined) pipeline.push({ $limit: context.limitCount });
  return pipeline;
};

const createFindCursor = <Shape extends SchemaShape, Relations extends SchemaRelationMap>(
  context: QueryExecutionContext<Shape, Relations>,
) => {
  let cursor = context.collection.find(searchFilter(context) as MongoFilter<StoredDocument<Shape>>);
  const sortSpec = context.sortSpec;
  if (sortSpec) cursor = cursor.sort(sortSpec as Sort);

  const skipCount = context.skipCount;
  if (skipCount !== undefined) cursor = cursor.skip(skipCount);

  const limitCount = context.limitCount;
  if (limitCount !== undefined) cursor = cursor.limit(limitCount);

  const projection = projectionFor(context.fields, context.hiddenFields, context.fieldSelection);

  if (projection) cursor = cursor.project(projection);
  return cursor;
};
