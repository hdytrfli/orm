import { describe, expect, it } from 'vitest';

import { orm } from '../../src/index.js';

describe('schema', () => {
  it('parses a schema definition', () => {
    const user = orm.schema({ name: orm.string(), age: orm.number() });

    expect(user.parse({ name: 'Ada', age: 36 })).toEqual({ name: 'Ada', age: 36 });
    expect(user.parsePartial({ age: 37 })).toEqual({ age: 37 });
    expect(() => user.parsePartial({ age: 'thirty-seven' })).toThrow('Invalid input');
  });

  it('parses nested object fields', () => {
    const profile = orm.schema({
      details: orm.object({
        website: orm.string().optional(),
        location: orm.object({ city: orm.string() }),
      }),
    });

    expect(
      profile.parse({ details: { website: 'example.test', location: { city: 'London' } } }),
    ).toEqual({
      details: { website: 'example.test', location: { city: 'London' } },
    });
  });

  it('preserves hidden metadata through common Zod wrappers', () => {
    const account = orm.schema({
      email: orm.string().email(),
      token: orm.string().optional().hidden(),
      backupToken: orm.string().nullable().hidden(),
    });

    expect(account.hiddenFields).toEqual(['token', 'backupToken']);
    expect(
      account.parse({ email: 'ada@example.test', token: undefined, backupToken: null }),
    ).toEqual({
      email: 'ada@example.test',
      token: undefined,
      backupToken: null,
    });
  });
});
