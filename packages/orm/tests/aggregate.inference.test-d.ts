import { describe, expectTypeOf, it } from 'vitest';

import type { createDatabase } from '../src/index.js';
import { orm } from '../src/index.js';

describe('aggregate inference', () => {
  it('retains the declared aggregate result shape', async () => {
    const userSchema = orm.schema({
      role: orm.enum(['admin', 'member']),
    });
    const database = {} as ReturnType<
      typeof createDatabase<{
        users: typeof userSchema;
      }>
    >;
    type RoleCount = {
      _id: string;
      count: number;
    };

    const counts = await database.users.aggregate<RoleCount>([
      {
        $group: {
          _id: '$role',
          count: {
            $sum: 1,
          },
        },
      },
    ]);

    const count: number | undefined = counts[0]?.count;
    const countType = expectTypeOf<RoleCount['count']>();

    void count;
    countType.toEqualTypeOf<number>();

    database.users.aggregate<RoleCount>([
      {
        $group: {
          // @ts-expect-error Aggregate references must exist in the source schema.
          _id: '$missing',
          count: {
            $sum: 1,
          },
        },
      },
    ]);
  });
});
