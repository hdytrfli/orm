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

  it('infers output types for opt-in coercing field constructors', () => {
    const requestSchema = orm.schema({
      age: orm.coerce.number(),
      enabled: orm.coerce.stringbool(),
      id: orm.coerce.objectId(),
    });
    const parsed = requestSchema.parse({
      age: '38',
      enabled: 'false',
      id: new ObjectId().toHexString(),
    });

    expectTypeOf(parsed.age).toEqualTypeOf<number>();
    expectTypeOf(parsed.enabled).toEqualTypeOf<boolean>();
    expectTypeOf(parsed.id).toEqualTypeOf<ObjectId>();
    expectTypeOf(
      requestSchema.parse({ age: 38, enabled: true, id: new ObjectId() }).enabled,
    ).toEqualTypeOf<boolean>();
  });
});
