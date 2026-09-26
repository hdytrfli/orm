import { describe, expect, it } from 'vitest';

import {
  populateProjectionFor,
  selectedPopulationFields,
} from '../src/query/population/projection.js';
import type { SchemaRelationMap, SchemaVirtualMap } from '../src/relations/definitions.js';

describe('population projections', () => {
  const relations = {
    owner: { localField: 'ownerId' },
    group: { localField: 'profile.groupId' },
  } as unknown as SchemaRelationMap;
  const virtuals = {
    projects: { localField: '_id' },
  } as unknown as SchemaVirtualMap;

  it('omits hidden fields by default but honors explicit selections', () => {
    expect(selectedPopulationFields(['name', 'password'], ['password'])).toEqual(['name']);
    expect(selectedPopulationFields(['name', 'password'], ['password'], ['name'])).toEqual([
      'name',
    ]);
  });

  it('includes selected fields, nested relation keys, and shown fields', () => {
    const projection = populateProjectionFor(
      ['name'],
      ['password'],
      [{ ref: 'owner' }, { virtual: 'projects' }],
      relations,
      virtuals,
    );

    expect(projection).toEqual({ name: 1, ownerId: 1, _id: 1, password: 1 });
  });

  it('normalizes duplicate and ancestor-overlapping projection paths', () => {
    const projection = populateProjectionFor(
      ['profile', 'profile.name', 'name'],
      ['name', 'profile.email'],
      [{ ref: 'group' }],
      relations,
      virtuals,
    );

    expect(projection).toEqual({ profile: 1, name: 1 });
  });

  it('supports a projection with no nested population metadata', () => {
    const projection = populateProjectionFor(['title'], undefined, [], relations, virtuals);

    expect(projection).toEqual({ title: 1 });
  });
});
