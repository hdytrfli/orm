import { describe, expect, it } from 'vitest';

import { orm } from '../../src/index.js';

describe('schema options', () => {
  it('adds managed timestamp and soft-delete fields', () => {
    const account = orm
      .schema({ name: orm.string() })
      .options({ timestamps: true, softdelete: true });

    const parsed = account.parse({ name: 'Ada' });

    expect(parsed.name).toBe('Ada');
    expect(parsed.createdAt).toBeInstanceOf(Date);
    expect(parsed.updatedAt).toBeInstanceOf(Date);
    expect(parsed.deletedAt).toBeNull();
    expect(account.optionsConfig).toEqual({ timestamps: true, softdelete: true });
  });

  it('rejects managed field name collisions', () => {
    expect(() => orm.schema({ createdAt: orm.string() }).options({ timestamps: true })).toThrow(
      'managed by Mongorm',
    );
    expect(() => orm.schema({ deletedAt: orm.date() }).options({ softdelete: true })).toThrow(
      'managed by Mongorm',
    );
  });

  it('uses defaults for optional input and required parsed output', () => {
    const account = orm.schema({ status: orm.string().default('pending') });
    const parsed = account.parse({});

    expect(parsed.status).toBe('pending');
  });

  it('stores typed MongoDB index definitions for explicit synchronization', () => {
    const account = orm
      .schema({ email: orm.string(), tenantId: orm.string() })
      .indexes([
        { fields: { tenantId: 1, email: 1 } },
        { fields: { email: 1 }, options: { unique: true, name: 'account_email_unique' } },
      ]);

    expect(account.indexDefinitions).toEqual([
      { fields: { tenantId: 1, email: 1 } },
      { fields: { email: 1 }, options: { unique: true, name: 'account_email_unique' } },
    ]);
  });

  it('rejects empty index definitions', () => {
    expect(() => orm.schema({ email: orm.string() }).indexes([{ fields: {} as never }])).toThrow(
      'at least one field',
    );
  });
});
