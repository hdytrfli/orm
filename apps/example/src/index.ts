import { createDatabase, orm } from '@mongorm/orm';

import { log } from '@/utils/logger';

const ROLES = ['admin', 'member'];

const userSchema = orm
  .schema({
    name: orm.string(),
    email: orm.email(),
    password: orm.string().hidden(),
    role: orm.enum(ROLES),
  })
  .options({
    timestamps: true,
  });

const schema = orm.defineSchemas({
  users: userSchema,
});

const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'app',
  schema,
});

await db.connect();

await db.users.bulk.create([
  { name: 'Grace Hopper', email: 'grace@example.com', role: 'member', password: 'password' },
  { name: 'Alan Turing', email: 'alan@example.com', role: 'admin', password: 'password' },
]);

const user = await db.users
  .find({ email: 'alan@example.com', role: 'admin' })
  .show(['password'])
  .first();

if (!user) throw new Error('User not found');
console.log(user);

try {
  log.info({ context: 'application', value: 'Mongorm example is connected' }, 'data');
  log.info({ context: 'models', value: ['users', 'groups', 'companies'] }, 'data');
} finally {
  await db.disconnect();
}
