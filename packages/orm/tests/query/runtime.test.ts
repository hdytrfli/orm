import { describe, expect, it } from 'vitest';

import { ObjectId, orm } from '../../src/index.js';
import { createCursorFilter } from '../../src/query/cursor/filter.js';
import { projectionFor } from '../../src/query/projection/runtime.js';
import { SoftDeleteState } from '../../src/query/soft-delete/state.js';
import type { ModelFilter } from '../../src/query/types.js';

const fields = {
  name: orm.string(),
  profile: orm.object({ city: orm.string(), country: orm.string() }),
  secret: orm.string().hidden(),
};
type Shape = typeof fields;

describe('query runtime policies', () => {
  it('builds visible projections when selection is empty', () => {
    expect(projectionFor(['name', 'profile.city', 'secret'], ['secret'], [], [])).toEqual({
      name: 1,
      'profile.city': 1,
    });
  });

  it('normalizes overlapping selected and shown fields', () => {
    expect(
      projectionFor(
        ['name', 'profile', 'profile.city', 'secret'],
        ['secret'],
        ['profile', 'profile.city'],
        ['secret'],
      ),
    ).toEqual({ profile: 1, secret: 1 });
  });

  it('applies active, deleted, and all soft-delete filters', () => {
    const filter = { name: 'Ada' } as ModelFilter<Shape>;
    const state = new SoftDeleteState<Shape>(true);

    expect(state.effectiveFilter(filter)).toEqual({
      $and: [{ deletedAt: null }, filter],
    });

    state.deleted('only');
    expect(state.effectiveFilter(filter)).toEqual({
      $and: [{ deletedAt: { $ne: null } }, filter],
    });

    state.includeDeleted();
    expect(state.effectiveFilter(filter)).toBe(filter);
  });

  it('adds an id cursor boundary without changing the base filter', () => {
    const filter = { name: 'Ada' } as ModelFilter<Shape>;
    const after = new ObjectId();

    expect(createCursorFilter(filter, after)).toEqual({
      $and: [filter, { _id: { $gt: after } }],
    });
    expect(createCursorFilter(filter)).toBe(filter);
  });
});
