import { describe, expect, it } from 'vitest';
import type { z } from 'zod';

import { prepareAggregatePipeline } from '../src/model/aggregate-runtime.js';
import type { ModelFilter } from '../src/query/types/filter.js';
import { InvalidQueryError } from '../src/validation/errors.js';

describe('aggregate pipeline preparation', () => {
  it('returns an independent copy when no model filter is required', () => {
    const pipeline = [{ $project: { name: 1 } }];
    const result = prepareAggregatePipeline(pipeline, false);

    expect(result).toEqual(pipeline);
    expect(result).not.toBe(pipeline);
  });

  it('injects user and soft-delete filters together', () => {
    const filter: ModelFilter<{ name: z.ZodString }> = { name: 'Ada' };
    const result = prepareAggregatePipeline([{ $project: { name: 1 } }], true, false, filter);

    expect(result[0]).toEqual({
      $match: {
        $and: [{ name: 'Ada' }, { deletedAt: null }],
      },
    });
  });

  it('places model filters after stages that must run first', () => {
    const pipeline = [{ $search: { text: { query: 'Ada', path: 'name' } } }];
    const result = prepareAggregatePipeline(pipeline, true);

    expect(result).toEqual([pipeline[0], { $match: { deletedAt: null } }]);
  });

  it('does not filter deleted records when includeDeleted is enabled', () => {
    const result = prepareAggregatePipeline([{ $project: { name: 1 } }], true, true);

    expect(result).toEqual([{ $project: { name: 1 } }]);
  });

  it('rejects model filters on stages that do not produce model documents', () => {
    expect(() => prepareAggregatePipeline([{ $documents: [{ name: 'Ada' }] }], true)).toThrow(
      InvalidQueryError,
    );
  });
});
