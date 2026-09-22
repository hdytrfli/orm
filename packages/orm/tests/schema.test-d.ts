import type { ObjectId } from 'mongodb';

import type { Db, Infer, InferShape } from '../src/index.js';
import { orm } from '../src/index.js';

const userSchema = orm.schema({
  name: orm.string(),
  role: orm.enum(['admin', 'member']),
});

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

const groupSchema = orm.schema({ name: orm.string() });
const memberSchema = orm.schema({
  group: orm.ref(() => groupSchema).optional(),
  nullableGroup: orm.ref(() => groupSchema).nullable(),
  nullishGroup: orm.ref(() => groupSchema).nullish(),
});
const targetGroup: typeof groupSchema = memberSchema.refs.group.resolve();
void targetGroup;
const member: Infer<typeof memberSchema> = {
  _id: userId,
  group: null as unknown as ObjectId,
  nullableGroup: null,
  nullishGroup: undefined,
};
void member;

declare const db: Db;
const users = db.model('users', userSchema);
await users.create({ name: 'Ada', role: 'member' });
await users.filter({ role: 'member' });
await users.filter({ role: { $in: ['admin', 'member'] } });
await users.filter({}).sort({ name: 'asc', role: 'desc' });
await users.filter({}).sort({ name: 'asc' }).skip(1);
await users.filter({}).sort({ name: 'asc' }).skip(1).limit(2);
await users.filter({ role: 'admin' }).count();
await users.filter().count(true);
const selectedUsers = await users.filter({}).select(['name', 'role']);
selectedUsers[0].name;
selectedUsers[0]._id;
// @ts-expect-error Unselected fields are omitted from the result type.
selectedUsers[0].age;
const selectedUser = await users.find({}).select(['name']);
selectedUser?.name;
selectedUser?._id;
// @ts-expect-error Unselected fields are omitted from the result type.
selectedUser?.role;
await users.filter({}).select();
await users.find({}).select();

const accountSchema = orm.schema({
  name: orm.string(),
  password: orm.string().hidden(),
});
const accounts = db.model('accounts', accountSchema);
const visibleAccounts = await accounts.filter();
visibleAccounts[0].name;
// @ts-expect-error Hidden fields are omitted from default results.
visibleAccounts[0].password;
const allAccounts = await accounts.filter().select(['*']);
allAccounts[0].password;
const explicitAccount = await accounts.find({}).select(['name', 'password']);
explicitAccount?.password;
await users.filter({
  $or: [{ role: 'admin' }, { name: { $regex: /^Ada/ } }],
});
await users.filter({
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
await metrics.filter({ age: { $gte: 18 } });
// @ts-expect-error Number operators reject string values.
await metrics.filter({ age: { $gte: 'adult' } });
// @ts-expect-error Logical filters still validate each branch.
await users.filter({ $or: [{ role: 'owner' }] });
// @ts-expect-error Sort fields are narrowed to schema fields.
await users.filter({}).sort({ unknown: 'asc' });
// @ts-expect-error Sort directions are restricted to asc/desc.
await users.filter({}).sort({ name: 'ascending' });
// @ts-expect-error Numeric MongoDB sort directions are intentionally not part of the API.
await users.filter({}).sort({ name: 1 });
// @ts-expect-error Skip requires a number.
await users.filter({}).skip('1');
// @ts-expect-error Limit requires a number.
await users.filter({}).limit('2');
// @ts-expect-error Estimate must be a boolean.
await users.filter({}).count('true');
