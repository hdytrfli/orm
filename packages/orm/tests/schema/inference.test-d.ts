/* oxlint-disable no-unused-expressions, no-unused-vars */

import type { ObjectId } from 'mongodb';

import type { Db, Infer, InferShape } from '../../src/index.js';
import { createDatabase, orm } from '../../src/index.js';

const userSchema = orm.schema({
  name: orm.string(),
  role: orm.enum(['admin', 'member']),
});

const indexedUserSchema = userSchema.indexes([
  {
    fields: { name: 1, role: -1 },
    options: {
      unique: true,
      name: 'user_name_role',
      partialFilterExpression: { role: { $eq: 'admin' } },
    },
  },
]);
void indexedUserSchema;
// @ts-expect-error Index definitions must contain at least one field.
userSchema.indexes([{ fields: {} }]);
// @ts-expect-error Index fields must be declared in the schema.
userSchema.indexes([{ fields: { missing: 1 } }]);
userSchema.indexes([
  {
    fields: { name: 1 },
    options: {
      // @ts-expect-error Partial index filters must use declared schema fields.
      partialFilterExpression: { missing: true },
    },
  },
]);
userSchema.indexes([
  {
    fields: { name: 1 },
    options: {
      partialFilterExpression: {
        // @ts-expect-error Unknown partial-filter fields are rejected even with null values.
        test: null,
      },
    },
  },
]);

type User = Infer<typeof userSchema>;
declare const userId: ObjectId;
const user: User = { _id: userId, name: 'Ada', role: 'admin' };
void user;

// @ts-expect-error The enum remains a literal union.
const invalidRole: User = { name: 'Ada', role: 'owner' };
void invalidRole;

// @ts-expect-error Unknown fields are not part of the inferred shape.
const invalidUser: User = { name: 'Ada', role: 'member', active: true };
void invalidUser;

const parsedUser: InferShape<typeof userSchema> = userSchema.parse({
  name: 'Ada',
  role: 'member',
});
void parsedUser;

const memberSchema = orm.schema({
  group: orm.objectId().optional(),
  nullableGroup: orm.objectId().nullable(),
  nullishGroup: orm.objectId().nullish(),
});
const member: Infer<typeof memberSchema> = {
  _id: userId,
  group: null as unknown as ObjectId,
  nullableGroup: null,
  nullishGroup: undefined,
};
void member;

declare const db: Db;
await db.sync({ dropIndexes: true });
const users = db.model('users', userSchema);
const managedFieldsSchema = orm
  .schema({ name: orm.string() })
  .options({ timestamps: true, softdelete: true, hideManaged: true });
const managedFieldsModel = db.model('managed-fields', managedFieldsSchema);
const defaultManagedFields = await managedFieldsModel.find();
// @ts-expect-error Managed fields are hidden by default.
defaultManagedFields[0].createdAt;
const shownManagedFields = await managedFieldsModel.find().show(['createdAt', 'deletedAt']);
shownManagedFields[0].createdAt;
shownManagedFields[0].deletedAt;
const indexedUsers = db.model('indexed-users', indexedUserSchema);
await indexedUsers.index.drop(['user_name_role']);
await indexedUsers.index.purge();
// @ts-expect-error Only explicitly named indexes can be dropped.
await indexedUsers.index.drop(['unknown_index']);
await users.create({ name: 'Ada', role: 'member' });

const defaultedSchema = orm.schema({ status: orm.string().default('pending') });
const defaultedModel = db.model('defaulted', defaultedSchema);
await defaultedModel.create({});
const defaultedDocument: Infer<typeof defaultedSchema> = { _id: userId, status: 'pending' };
void defaultedDocument;
// @ts-expect-error Defaulted fields are required in persisted documents.
const missingDefault: Infer<typeof defaultedSchema> = { _id: userId };
void missingDefault;

await users.find({ role: 'member' });
await users.find({ role: { $in: ['admin', 'member'] } });
await users.find({}).sort({ name: 'asc', role: 'desc' });
await users.find({}).sort({ name: 'asc' }).skip(1);
await users.find({}).sort({ name: 'asc' }).skip(1).limit(2);
await users.find({ role: 'admin' }).count();
await users.find().count(true);
const firstPage = users.find().limit(2).cursor();
for await (const firstUser of firstPage) firstUser.name;
firstPage.next;
const nextPage = await users
  .find()
  .limit(2)
  .cursor(firstPage.next ?? undefined);
for await (const nextUser of nextPage) nextUser.name;
// @ts-expect-error Cursor positions use ObjectId values.
await users.find().limit(2).cursor('after');
// @ts-expect-error Cursor pagination cannot be combined with skip.
users.find().limit(2).skip(1).cursor();
// @ts-expect-error Cursor pagination cannot use custom sorting yet.
users.find().limit(2).sort({ name: 'asc' }).cursor();
const selectedUsers = await users.find({}).select(['name', 'role']);
selectedUsers[0].name;
selectedUsers[0]._id;
// @ts-expect-error Unselected fields are omitted from the result type.
selectedUsers[0].age;
const selectedUser = await users.find({}).select(['name']).first();
selectedUser?.name;
selectedUser?._id;
// @ts-expect-error Unselected fields are omitted from the result type.
selectedUser?.role;
await users.find({}).select();
await users.find({}).select().first();
const firstUser = await users.find({}).first();
firstUser?.name;
// @ts-expect-error A first query resolves to a document and cannot chain list methods.
users.find({}).first().limit(1);
// @ts-expect-error Deleted query modes are only available for soft-delete schemas.
users.find().deleted('only');
// @ts-expect-error Permanent deletion is only available for soft-delete schemas.
users.purge({});

const profileSchema = orm.schema({
  profile: orm.object({
    website: orm.string(),
    location: orm.object({ city: orm.string() }),
  }),
});
const profiles = db.model('profiles', profileSchema);
await profiles.find({ 'profile.location.city': 'London' });
// @ts-expect-error Nested filter paths must refer to declared object fields.
await profiles.find({ 'profile.location.country.code': 'GB' });
await profiles.find({}).select(['profile.website', 'profile.location.city']);
// @ts-expect-error Nested select paths must refer to declared object fields.
await profiles.find({}).select(['profile.location.country']);

const zodFeatures = orm.schema({
  email: orm.email(),
  website: orm.url(),
  secret: orm.string().optional().hidden(),
});
void zodFeatures;

const accountSchema = orm.schema({
  name: orm.string(),
  password: orm.string().hidden(),
});
const accounts = db.model('accounts', accountSchema);
const visibleAccounts = await accounts.find();
visibleAccounts[0].name;
// @ts-expect-error Hidden fields are omitted from default results.
visibleAccounts[0].password;
const allAccounts = await accounts.find().show(['password']);
allAccounts[0].password;
const explicitAccount = await accounts.find({}).select(['name']).show(['password']).first();
explicitAccount?.password;
// @ts-expect-error _id is always included and is not a selectable field.
await accounts.find().select(['_id']);
// @ts-expect-error Only hidden fields can be shown.
await accounts.find().show(['name']);

const relationGroupSchema = orm.schema({ name: orm.string(), secret: orm.string().hidden() });
const relationUserSchema = orm.schema({
  name: orm.string(),
  groupId: orm.objectId().optional(),
});
const relatedUserSchema = relationUserSchema.relations({
  groupId: () => relationGroupSchema,
});
void relatedUserSchema.relationMap.groupId;
// @ts-expect-error Relations require an ObjectId field on the local schema.
groupSchema.relations({ name: () => relationUserSchema });
const relatedUsers = db.model('related-users', relatedUserSchema);
const populatedUsers = await relatedUsers.find().populate([{ ref: 'groupId', select: ['name'] }]);
populatedUsers[0].groupId?.name;
// @ts-expect-error Hidden target fields are omitted unless requested with show.
populatedUsers[0].groupId?.secret;
// @ts-expect-error Population replaces the local ObjectId with the populated document.
const groupId: ObjectId = populatedUsers[0].groupId;
const populatedUsersWithHidden = await relatedUsers
  .find()
  .populate([{ ref: 'groupId', select: ['name'], show: ['secret'] }]);
populatedUsersWithHidden[0].groupId?.secret;
// @ts-expect-error Populate show only accepts hidden fields on the target schema.
relatedUsers.find().populate([{ ref: 'groupId', show: ['name'] }]);

const schema = orm
  .defineSchemas({
    users: relationUserSchema,
    groups: relationGroupSchema,
  })
  .defineRelations({
    users: { groupId: 'groups' },
  })
  .defineScopes({
    users: {
      detail: [{ ref: 'groupId', select: ['name'] }],
    },
  });
const registeredDb = createDatabase({
  uri: 'mongodb://127.0.0.1:27017',
  database: 'mongorm_registry_test',
  schemas: schema,
});
await registeredDb.users.find({});
await registeredDb.groups.find({});
await registeredDb.users.upsert({ name: 'Ada' }, { groupId: userId });
// @ts-expect-error Upsert filters are constrained to the schema's fields.
await registeredDb.users.upsert({ missing: true }, {});
// @ts-expect-error Upsert filters only accept schema fields, not dotted paths.
await registeredDb.users.upsert({ 'name.first': 'Ada' }, { name: 'Ada' });
// @ts-expect-error Filter fields are supplied by the filter and cannot be repeated in data.
await registeredDb.users.upsert({ name: 'Ada' }, { name: 'Ada' });
// @ts-expect-error Upsert data must provide the remaining required create fields.
await registeredDb.users.upsert({}, {});
// @ts-expect-error Only registered plural schema names are exposed as models.
await registeredDb.user.find({});

const plainRegistryDb = createDatabase({
  uri: 'mongodb://127.0.0.1:27017',
  database: 'mongorm_plain_registry_test',
  schemas: { users: relationUserSchema, groups: relationGroupSchema },
});
await plainRegistryDb.users.find({ name: 'Ada' });
await plainRegistryDb.groups.find({ name: 'Group' });
// @ts-expect-error Plain schema registries only expose their registered model names.
plainRegistryDb.posts;

// @ts-expect-error Database creation requires a schema registry.
createDatabase({ uri: 'mongodb://127.0.0.1:27017', database: 'mongorm_unregistered_test' });

const scopedUserSchema = relationUserSchema
  .relations({ groupId: () => relationGroupSchema })
  .scopes({ detail: [{ ref: 'groupId', select: ['name'] }] });
const scopedUsers = db.model('scoped-users', scopedUserSchema);
const detailedUsers = await scopedUsers.find().with('detail');
detailedUsers[0].groupId?.name;
const ownerSchema = orm.schema({ username: orm.string() });
const projectSchema = orm.schema({ owner: orm.objectId() });
const taskSchema = orm.schema({ project: orm.objectId() });
const nestedRegistry = orm
  .defineSchemas({ tasks: taskSchema, projects: projectSchema, owners: ownerSchema })
  .defineRelations({
    tasks: { project: 'projects' },
    projects: { owner: 'owners' },
  })
  .defineScopes({
    tasks: { check: [{ ref: 'project', populate: [{ ref: 'owner' }] }] },
  });
const nestedDb = createDatabase({
  uri: 'mongodb://127.0.0.1:27017',
  database: 'mongorm_nested_registry_test',
  schemas: nestedRegistry,
});
const nestedTask = await nestedDb.tasks.find().with('check').first();
nestedTask?.project?.owner?.username;
// @ts-expect-error Nested population still exposes only fields on the related schema.
nestedTask?.project?.owner?.missing;
// @ts-expect-error Scope names are inferred from Schema.scopes().
scopedUsers.find().with('summary');
scopedUsers
  .find()
  .with('detail')
  // @ts-expect-error A query cannot combine a named scope with explicit population.
  .populate([{ ref: 'groupId' }]);
const populatedScopedUsers = scopedUsers.find().populate([{ ref: 'groupId' }]);
// @ts-expect-error A query cannot combine explicit population with a named scope.
populatedScopedUsers.with('detail');

await users.find({
  $or: [{ role: 'admin' }, { name: { $regex: /^Ada/ } }],
});
await users.find({
  $and: [{ role: { $ne: 'member' } }, { name: { $exists: true } }],
});
await users.find({ name: 'Ada' });
await users.update({ role: 'member' }, { name: 'Ada Lovelace' });
await users.delete({ role: 'member' });
// @ts-expect-error Filters are narrowed to the schema's fields.
await users.find({ unknown: true });
// @ts-expect-error Operator values remain narrowed to the field's literal union.
await users.find({ role: { $in: ['owner'] } });
// @ts-expect-error Updates cannot add unknown fields.
await users.update({}, { unknown: true });

const metricSchema = orm.schema({ age: orm.number() });
const metrics = db.model('metrics', metricSchema);
await metrics.find({ age: { $gte: 18 } });
// @ts-expect-error Number operators reject string values.
await metrics.find({ age: { $gte: 'adult' } });
// @ts-expect-error Logical filters still validate each branch.
await users.find({ $or: [{ role: 'owner' }] });
// @ts-expect-error Sort fields are narrowed to schema fields.
await users.find({}).sort({ unknown: 'asc' });
// @ts-expect-error Sort directions are restricted to asc/desc.
await users.find({}).sort({ name: 'ascending' });
// @ts-expect-error Numeric MongoDB sort directions are intentionally not part of the API.
await users.find({}).sort({ name: 1 });
// @ts-expect-error Skip requires a number.
await users.find({}).skip('1');
// @ts-expect-error Limit requires a number.
await users.find({}).limit('2');
// @ts-expect-error Estimate must be a boolean.
await users.find({}).count('true');
