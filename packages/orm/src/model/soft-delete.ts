import type { ModelFilter } from '../query/types.js';
import type { SchemaShape } from '../schema/contracts.js';

export type SoftDeleteMode = 'active' | 'deleted' | 'all';

export const applySoftDeleteFilter = <Shape extends SchemaShape>(
  filter: ModelFilter<Shape>,
  mode: SoftDeleteMode,
): ModelFilter<Shape> => {
  if (mode === 'all') return filter;

  const deletionFilter = mode === 'deleted' ? { deletedAt: { $ne: null } } : { deletedAt: null };
  return { $and: [deletionFilter, filter] } as ModelFilter<Shape>;
};
