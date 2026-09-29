import { describe, expectTypeOf, it } from 'vitest';

import type { Infer } from '../src/index.js';
import { ObjectId, orm } from '../src/index.js';

describe('schema inference', () => {
  it('infers enum literals and requires defaulted fields in documents', () => {
    const accountSchema = orm.schema({
      name: orm.string(),
      role: orm.enum(['admin', 'member']),
      status: orm.string().default('pending'),
    });

    type Account = Infer<typeof accountSchema>;
    const account: Account = {
      _id: new ObjectId(),
      name: 'Ada',
      role: 'admin',
      status: 'pending',
    };

    const roleType = expectTypeOf<Account['role']>();
    const statusType = expectTypeOf<Account['status']>();

    void account;
    roleType.toEqualTypeOf<'admin' | 'member'>();
    statusType.toEqualTypeOf<string>();

    const invalidRole: Account = {
      _id: new ObjectId(),
      name: 'Ada',
      // @ts-expect-error Enum fields reject undeclared values.
      role: 'owner',
      status: 'pending',
    };

    void invalidRole;

    // @ts-expect-error Defaulted fields are required on parsed documents.
    const missingStatus: Account = {
      _id: new ObjectId(),
      name: 'Ada',
      role: 'member',
    };
    void missingStatus;
  });

  it('keeps the parsed output type on the coerced transport schema', () => {
    const requestSchema = orm.schema({
      age: orm.number(),
      enabled: orm.boolean(),
      id: orm.objectId(),
    });
    const parsed = requestSchema.coerced.parse({
      age: '38',
      enabled: 'false',
      id: new ObjectId().toHexString(),
    });

    expectTypeOf(parsed.age).toEqualTypeOf<number>();
    expectTypeOf(parsed.enabled).toEqualTypeOf<boolean>();
    expectTypeOf(parsed.id).toEqualTypeOf<ObjectId>();
  });
});
