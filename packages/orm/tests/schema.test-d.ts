import type { ObjectId } from 'mongodb';

import type { Infer } from '../src/index.js';
import { orm } from '../src/index.js';

const userSchema = orm.schema({
  name: orm.string(),
  role: orm.enum(['admin', 'member']),
});

type User = Infer<typeof userSchema>;
const user: User = { name: 'Ada', role: 'admin' };
void user;

// @ts-expect-error The enum remains a literal union.
const invalidRole: User = { name: 'Ada', role: 'owner' };
void invalidRole;

// @ts-expect-error Unknown fields are not part of the inferred shape.
const invalidUser: User = { name: 'Ada', role: 'member', active: true };
void invalidUser;

const parsedUser: User = userSchema.parse({ name: 'Ada', role: 'member' });
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
  group: null as unknown as ObjectId,
  nullableGroup: null,
  nullishGroup: undefined,
};
void member;
