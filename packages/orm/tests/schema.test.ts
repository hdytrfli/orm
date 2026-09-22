import { describe, expect, it } from 'vitest';

import { orm } from '../src/index.js';

describe('schema', () => {
  it('parses a schema definition', () => {
    const user = orm.schema({ name: orm.string(), age: orm.number() });

    expect(user.parse({ name: 'Ada', age: 36 })).toEqual({ name: 'Ada', age: 36 });
  });

  it('collects lazy relation metadata without evaluating it during construction', () => {
    const group = orm.schema({ name: orm.string() });
    const user = orm.schema({ group: orm.ref(() => group) });

    expect(user.refs.group.resolve()).toBe(group);
    expect(user.parse({ group: 'group-1' })).toEqual({ group: 'group-1' });
  });
});
