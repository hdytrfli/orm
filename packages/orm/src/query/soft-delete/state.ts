import type { DeletedQueryMode, SoftDeleteMode } from '../../model/soft-delete.js';
import { applySoftDeleteFilter } from '../../model/soft-delete.js';
import type { SchemaShape } from '../../schema/contracts.js';
import type { ModelFilter } from '../types/filter.js';

/** Query-local state for composing a schema's default soft-delete filter. */
export class SoftDeleteState<Shape extends SchemaShape> {
  private mode: SoftDeleteMode = 'active';

  constructor(private readonly enabled: boolean) {}

  includeDeleted(): void {
    this.mode = 'all';
  }

  deleted(mode: DeletedQueryMode): void {
    this.mode = mode === 'include' ? 'all' : 'deleted';
  }

  isFiltered(): boolean {
    return this.enabled && this.mode !== 'all';
  }

  effectiveFilter(filter: ModelFilter<Shape>): ModelFilter<Shape> {
    return applySoftDeleteFilter(filter, this.mode);
  }
}
