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

  it('constructs circular schemas through a registry', () => {
    const schemas = orm.registry({
      group: (ref) => ({
        name: orm.string(),
        creator: ref('user'),
      }),
      user: (ref) => ({
        name: orm.string(),
        group: ref('group').optional(),
      }),
    });

    const group = schemas.get('group');
    const user = schemas.get('user');
    expect(group.refs.creator.resolve()).toBe(user);
    expect(user.refs.group.resolve()).toBe(group);
  });
});
