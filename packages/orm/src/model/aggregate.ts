import type { AggregateOptions, Condition, Document } from 'mongodb';

import type { ModelDocument } from '../query/types/document.js';
import type { ModelFilter, NestedFilterKey } from '../query/types/filter.js';
import type { SchemaShape } from '../schema/contracts.js';
import { InvalidQueryError } from '../validation/errors.js';

type SourceField<Shape extends SchemaShape> =
  | Extract<keyof Shape, string>
  | Extract<keyof ModelDocument<Shape> | NestedFilterKey<ModelDocument<Shape>>, string>;
type ResultField<Result extends Document> = Extract<keyof Result, string>;
type ResultPath<Result extends Document> = Extract<keyof Result | NestedFilterKey<Result>, string>;
type AggregateField<Shape extends SchemaShape, Result extends Document> =
  | SourceField<Shape>
  | ResultPath<Result>;
type FieldReference<Shape extends SchemaShape, Result extends Document> = `$${AggregateField<
  Shape,
  Result
>}`;
type AggregateExpression<Shape extends SchemaShape, Result extends Document> =
  | FieldReference<Shape, Result>
  | number
  | boolean
  | null
  | Document;

type AggregateResultFilter<Result extends Document> = Partial<{
  [Field in keyof Result]: Condition<Result[Field]>;
}> & {
  $and?: AggregateResultFilter<Result>[];
  $nor?: AggregateResultFilter<Result>[];
  $or?: AggregateResultFilter<Result>[];
};

type GroupAccumulator<Shape extends SchemaShape, Result extends Document> =
  | { $sum: AggregateExpression<Shape, Result> }
  | { $avg: AggregateExpression<Shape, Result> }
  | { $min: AggregateExpression<Shape, Result> }
  | { $max: AggregateExpression<Shape, Result> }
  | { $first: AggregateExpression<Shape, Result> }
  | { $last: AggregateExpression<Shape, Result> }
  | { $push: AggregateExpression<Shape, Result> }
  | { $addToSet: AggregateExpression<Shape, Result> }
  | { $count: Record<string, never> };

type GroupFields<Shape extends SchemaShape, Result extends Document> = {
  _id: AggregateExpression<Shape, Result>;
} & {
  [Field in Exclude<keyof Result, '_id'>]-?: GroupAccumulator<Shape, Result>;
};

type AggregateSort<Shape extends SchemaShape, Result extends Document> = Partial<
  Record<AggregateField<Shape, Result>, 1 | -1>
>;

type AggregateProjection<Shape extends SchemaShape, Result extends Document> = Partial<
  Record<AggregateField<Shape, Result>, 0 | 1 | boolean | AggregateExpression<Shape, Result>>
>;
type UnwindOptions<Shape extends SchemaShape, Result extends Document> = {
  path: FieldReference<Shape, Result>;
  includeArrayIndex?: ResultField<Result>;
  preserveNullAndEmptyArrays?: boolean;
};

/** Common MongoDB stages with schema-aware source and result field hints. */
export type AggregateStage<Shape extends SchemaShape, Result extends Document> =
  | { $match: ModelFilter<Shape> | AggregateResultFilter<Result> }
  | { $group: GroupFields<Shape, Result> }
  | { $sort: AggregateSort<Shape, Result> }
  | { $project: AggregateProjection<Shape, Result> }
  | { $limit: number }
  | { $skip: number }
  | { $count: ResultField<Result> }
  | { $unwind: FieldReference<Shape, Result> | UnwindOptions<Shape, Result> }
  | { $set: AggregateProjection<Shape, Result> }
  | { $addFields: AggregateProjection<Shape, Result> }
  | { $unset: AggregateField<Shape, Result> | AggregateField<Shape, Result>[] }
  | { $sortByCount: AggregateExpression<Shape, Result> }
  | { $geoNear: Document }
  | { $search: Document }
  | { $vectorSearch: Document }
  | { $lookup: Document }
  | { $graphLookup: Document }
  | { $facet: Record<string, Document[]> }
  | { $bucket: Document }
  | { $bucketAuto: Document }
  | { $unionWith: string | Document }
  | { $replaceRoot: Document }
  | { $replaceWith: Document }
  | { $out: string | Document }
  | { $merge: string | Document }
  | { $densify: Document }
  | { $fill: Document }
  | { $setWindowFields: Document };

/** Typed aggregation pipeline. Common stages check field paths against source and result types. */
export type AggregatePipeline<
  Shape extends SchemaShape,
  Result extends Document,
> = readonly AggregateStage<Shape, Result>[];

/** Aggregation options, with deleted-record inclusion available only on soft-delete models. */
export type ModelAggregateOptions<
  Shape extends SchemaShape,
  SoftDelete extends boolean,
> = AggregateOptions & {
  /** Schema-checked filter applied to source documents before pipeline transformations. */
  filter?: ModelFilter<Shape>;
} & (SoftDelete extends true ? { includeDeleted?: boolean } : { includeDeleted?: never });

const FIRST_STAGE_ONLY_STAGES = new Set(['$geoNear', '$search', '$vectorSearch']);
const STAGES_WITHOUT_MODEL_DOCUMENTS = new Set([
  '$changeStream',
  '$collStats',
  '$indexStats',
  '$planCacheStats',
  '$searchMeta',
  '$documents',
]);

/** Add the model's default soft-delete match without invalidating first-stage-only operators. */
export const prepareAggregatePipeline = <Shape extends SchemaShape>(
  pipeline: readonly Document[],
  softDeleteEnabled: boolean,
  includeDeleted = false,
  filter?: ModelFilter<Shape>,
): Document[] => {
  const stages = [...pipeline];
  const shouldApplySoftDelete = softDeleteEnabled && !includeDeleted;
  const hasUserFilter = filter !== undefined && Object.keys(filter).length > 0;
  if (!shouldApplySoftDelete && !hasUserFilter) return stages;

  const firstStageName = stages[0] ? Object.keys(stages[0])[0] : undefined;
  if (firstStageName && STAGES_WITHOUT_MODEL_DOCUMENTS.has(firstStageName)) {
    throw new InvalidQueryError(
      `Aggregation stage "${firstStageName}" does not produce model documents for filtering. Remove the filter or use the native MongoDB API for this stage.`,
    );
  }

  const filterConditions: Document[] = [];
  if (hasUserFilter && filter) filterConditions.push(filter);
  if (shouldApplySoftDelete) filterConditions.push({ deletedAt: null });

  const [onlyFilter] = filterConditions;
  const matchFilter = filterConditions.length === 1 ? onlyFilter : { $and: filterConditions };
  const modelMatchStage: Document = { $match: matchFilter };
  const insertionIndex = firstStageName && FIRST_STAGE_ONLY_STAGES.has(firstStageName) ? 1 : 0;
  stages.splice(insertionIndex, 0, modelMatchStage);
  return stages;
};
