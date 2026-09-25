import { describe, expectTypeOf, it } from 'vitest';

import type { createDatabase } from '../src/index.js';
import { orm } from '../src/index.js';

describe('query inference', () => {
  const userSchema = orm.schema({
    name: orm.string(),
    role: orm.enum(['admin', 'member']),
    password: orm.string().hidden(),
  });

  const database = {} as ReturnType<
    typeof createDatabase<{
      users: typeof userSchema;
    }>
  >;
  const users = database.users;

  it('narrows result fields to the selected fields', async () => {
    const selectedUsers = await users.find().select(['name']);
    const userName: string = selectedUsers[0].name;
    const userId = selectedUsers[0]._id;
    const nameType = expectTypeOf(userName);

    void userName;
    void userId;
    nameType.toEqualTypeOf<string>();

    // @ts-expect-error Unselected fields are omitted from query results.
    const omittedRole = selectedUsers[0].role;
    void omittedRole;
  });

  it('omits hidden fields unless explicitly shown', async () => {
    const visibleUsers = await users.find();
    const usersWithPassword = await users.find().show(['password']);
    const password: string = usersWithPassword[0].password;
    const passwordType = expectTypeOf(password);

    void password;
    passwordType.toEqualTypeOf<string>();

    // @ts-expect-error Hidden fields are absent by default.
    const hiddenPassword = visibleUsers[0].password;
    void hiddenPassword;
  });

  it('restricts filters to fields declared in the schema', async () => {
    const validQuery = users.find({
      role: 'admin',
    });
    const queryType = expectTypeOf(validQuery);
    queryType.not.toBeAny();

    await users.find({
      // @ts-expect-error Filters reject undeclared fields.
      unknown: true,
    });
  });
});
