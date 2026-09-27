import { describe, expectTypeOf, it } from 'vitest';

import type { createDatabase, ModelScopeName, ModelSoftDeleteEnabled } from '../src/index.js';
import { orm } from '../src/index.js';

describe('query inference', () => {
  const userSchema = orm.schema({
    name: orm.string(),
    role: orm.enum(['admin', 'member']),
    password: orm.string().hidden(),
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
    const selectedUsers = await users.find().fields(['name']);
    const userName: string = selectedUsers[0].name;
    const userId = selectedUsers[0]._id;
    const nameType = expectTypeOf(userName);

    void userName;
    void userId;
    nameType.toEqualTypeOf<string>();

    // @ts-expect-error Unselected fields are omitted from query results.
    const omittedRole = selectedUsers[0].role;
    void omittedRole;

    // @ts-expect-error Hidden field selectors require `+` and the field must be hidden.
    users.find().fields(['+name']);
    // @ts-expect-error Field selectors are checked against the schema.
    users.find().fields(['notAUserField']);

    const arraySchema = orm.schema({ tags: orm.array(orm.string()) });
    const arrayDatabase = {} as ReturnType<typeof createDatabase<{ arrays: typeof arraySchema }>>;
    // @ts-expect-error Array implementation properties are not document field paths.
    arrayDatabase.arrays.find().fields(['tags.length']);
  });

  it('omits hidden fields unless explicitly selected with a plus prefix', async () => {
    const visibleUsers = await users.find();
    const usersWithPassword = await users.find().fields(['$all', '+password']);
    const password: string = usersWithPassword[0].password;
    const passwordType = expectTypeOf(password);

    void password;
    passwordType.toEqualTypeOf<string>();
    const onlyPassword = await users.find().fields(['+password']);
    const onlyPasswordValue: string = onlyPassword[0].password;
    // @ts-expect-error A hidden-only selection does not include visible fields.
    const omittedName = onlyPassword[0].name;
    void onlyPasswordValue;
    void omittedName;

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
