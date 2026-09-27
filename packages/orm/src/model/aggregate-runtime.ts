import type { Document } from 'mongodb';

import type { ModelFilter } from '../query/types/filter.js';
import type { SchemaShape } from '../schema/contracts.js';
import { InvalidQueryError } from '../validation/errors.js';

const FIRST_STAGE_ONLY_STAGES = new Set(['$geoNear', '$search', '$vectorSearch']);
const STAGES_WITHOUT_MODEL_DOCUMENTS = new Set([
  '$changeStream',
  '$collStats',
  '$indexStats',
  '$planCacheStats',
  '$searchMeta',
  '$documents',
]);

/** Add model filters without invalidating first-stage-only aggregation operators. */
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

  const conditions: Document[] = [];
  if (hasUserFilter && filter) conditions.push(filter);
  if (shouldApplySoftDelete) conditions.push({ deletedAt: null });

  const [onlyCondition] = conditions;
  const matchFilter = conditions.length === 1 ? onlyCondition : { $and: conditions };
  const modelMatchStage: Document = { $match: matchFilter };
  const insertionIndex = firstStageName && FIRST_STAGE_ONLY_STAGES.has(firstStageName) ? 1 : 0;
  stages.splice(insertionIndex, 0, modelMatchStage);
  return stages;
};
