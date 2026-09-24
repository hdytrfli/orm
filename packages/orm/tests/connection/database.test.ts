import { describe, expect, it } from 'vitest';

import { createDatabase, orm } from '../../src/index.js';

describe('database connection', () => {
  it('registers schemas as database models', () => {
    const users = orm.schema({ name: orm.string() });
    const db = createDatabase({
      uri: 'mongodb://127.0.0.1:27017',
      database: 'mongorm_registry_test',
      schemas: { users },
    });

    expect(db.users.name).toBe('users');
    expect(db.users).toBe(db.users);
  });

  it('rejects registering one schema to multiple collections', () => {
    const users = orm.schema({ name: orm.string() });
    const db = createDatabase({
      uri: 'mongodb://127.0.0.1:27017',
      database: 'mongorm_registry_test',
      schemas: { users },
    });

    expect(() => db.model('accounts', users)).toThrow('already registered with collection "users"');
  });
});
