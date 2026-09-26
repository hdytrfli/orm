import { describe, expectTypeOf, it } from 'vitest';

import { ObjectId } from '../src/index.js';
import type { createDatabase, ModelScopeName, ModelSoftDeleteEnabled } from '../src/index.js';
import { orm } from '../src/index.js';

describe('query inference', () => {
  const userSchema = orm.schema({
    name: orm.string(),
    role: orm.enum(['admin', 'member']),
    status: orm.enum(['backlog', 'todo', 'in-progress', 'blocked', 'done']),
    password: orm.string().hidden(),
    profile: orm.object({ city: orm.string() }),
  });

  const registry = orm
    .defineSchemas({ users: userSchema })
    .defineScopes({ users: { list: [], detail: [] } });
  const database = {} as ReturnType<typeof createDatabase<typeof registry>>;
  const users = database.users;

  it('exposes scope names and soft-delete support through model features', () => {
    type UserScope = ModelScopeName<typeof users>;
    type SupportsSoftDelete = ModelSoftDeleteEnabled<typeof users>;
    const scopeNames = expectTypeOf<UserScope>();
    const softDeleteSupport = expectTypeOf<SupportsSoftDelete>();
    const availableScopes: readonly UserScope[] = users.features.scopes;
    const softDeleteEnabled: false = users.features.softdelete;
    const softDeleteSchema = orm.schema({ name: orm.string() }).options({ softdelete: true });
    const softDeleteDatabase = {} as ReturnType<
      typeof createDatabase<{ users: typeof softDeleteSchema }>
    >;
    type SoftDeletedModel = typeof softDeleteDatabase.users;
    type SoftDeleted = ModelSoftDeleteEnabled<SoftDeletedModel>;
    const softDeleteModelFeature: true = softDeleteDatabase.users.features.softdelete;
    const softDeletedType = expectTypeOf<SoftDeleted>();

    void availableScopes;
    void softDeleteEnabled;
    void softDeleteModelFeature;
    scopeNames.toEqualTypeOf<'list' | 'detail'>();
    softDeleteSupport.toEqualTypeOf<false>();
    softDeletedType.toEqualTypeOf<true>();
  });

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

  it('accepts native MongoDB aggregation expressions in $expr filters', () => {
    const status = 'todo' as const;
    const transitionFilter = {
      $expr: {
        $in: [
          '$status',
          {
            $switch: {
              branches: [
                {
                  case: { $eq: [{ $literal: status }, 'todo'] },
                  then: ['backlog', 'in-progress', 'blocked'],
                },
                {
                  case: { $eq: [{ $literal: status }, 'in-progress'] },
                  then: ['todo', 'blocked', 'done'],
                },
                {
                  case: { $eq: [{ $literal: status }, 'blocked'] },
                  then: ['todo', 'in-progress'],
                },
                {
                  case: { $eq: [{ $literal: status }, 'done'] },
                  then: ['in-progress'],
                },
              ],
              default: [],
            },
          },
        ],
      },
    };
    const transitionQuery = users.find(transitionFilter);
    users.update({ _id: new ObjectId(), ...transitionFilter }, { status });

    expectTypeOf(transitionQuery).not.toBeAny();
  });
});
