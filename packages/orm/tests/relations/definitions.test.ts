import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';

import { orm } from '../../src/index.js';

describe('relations', () => {
  it('collects lazy relation metadata without evaluating it during construction', () => {
    const group = orm.schema({ name: orm.string() });
    const user = orm.schema({
      group: orm.ref(() => group).optional(),
      nullableGroup: orm.ref(() => group).nullable(),
      nullishGroup: orm.ref(() => group).nullish(),
    });

    expect(user.refs.group.resolve()).toBe(group);
    const groupId = new ObjectId();
    expect(user.parse({ group: groupId, nullableGroup: null, nullishGroup: undefined })).toEqual({
      group: groupId,
      nullableGroup: null,
      nullishGroup: undefined,
    });
    expect(() => user.parse({ group: 'group-1' })).toThrow('Invalid input');
  });

  it('declares one-way relations and population scopes', () => {
    const group = orm.schema({ name: orm.string() });
    const user = orm
      .schema({ name: orm.string(), group: orm.objectId().optional() })
      .relations({ group: () => group })
      .scopes({ detail: [{ ref: 'group', select: ['name'] }] });

    expect(user.relationMap.group.resolve()).toBe(group);
    expect(user.relationMap.group.localField).toBe('group');
    expect(user.scopeMap.detail).toEqual([{ ref: 'group', select: ['name'] }]);
  });
});
