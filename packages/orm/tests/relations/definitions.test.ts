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

  it('defines typed virtual relation metadata on registered schemas', () => {
    const users = orm.schema({ name: orm.string() });
    const projects = orm.schema({ owner: orm.objectId(), title: orm.string() });
    const registry = orm.defineSchemas({ users, projects }).defineVirtual({
      users: {
        projects: { ref: 'projects', localField: '_id', foreignField: 'owner' },
      },
    });

    expect(registry.users.virtualMap.projects.resolve()).toBe(projects);
    expect(registry.users.virtualMap.projects.localField).toBe('_id');
    expect(registry.users.virtualMap.projects.foreignField).toBe('owner');
  });
});
