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
});
