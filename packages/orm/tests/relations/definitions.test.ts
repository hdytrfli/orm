import { describe, expect, it } from 'vitest';

import { orm } from '../../src/index.js';

describe('relations', () => {
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
