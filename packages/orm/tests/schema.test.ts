import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';

import { orm } from '../src/index.js';

describe('schema', () => {
  it('parses a schema definition', () => {
    const user = orm.schema({ name: orm.string(), age: orm.number() });

    expect(user.parse({ name: 'Ada', age: 36 })).toEqual({ name: 'Ada', age: 36 });
    expect(user.parsePartial({ age: 37 })).toEqual({ age: 37 });
    expect(() => user.parsePartial({ age: 'thirty-seven' })).toThrow();
  });

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
    expect(() => user.parse({ group: 'group-1' })).toThrow();
  });

  it('declares one-way relations after schema construction', () => {
    const group = orm.schema({ name: orm.string() });
    const user = orm.schema({ name: orm.string(), group: orm.objectId().optional() });
    const userWithRelations = user.relations({
      group: () => group,
    });

    expect(userWithRelations.relationMap.group.resolve()).toBe(group);
    expect(userWithRelations.relationMap.group.localField).toBe('group');
  });

  it('declares named population scopes after relations', () => {
    const group = orm.schema({ name: orm.string() });
    const user = orm
      .schema({ group: orm.objectId() })
      .relations({ group: () => group })
      .scopes({ detail: [{ ref: 'group', select: ['name'] }] });

    expect(user.scopeMap.detail).toEqual([{ ref: 'group', select: ['name'] }]);
  });
});
