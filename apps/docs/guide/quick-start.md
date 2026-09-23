# Quick Start

This example defines a user model, registers it, and performs a typed query.

```ts
import { createDatabase, orm } from '@mongorm/orm';

const userSchema = orm.schema({
  name: orm.string(),
  email: orm.email(),
  age: orm.number().int().nonnegative(),
  password: orm.string().hidden(),
});

const schema = orm.defineSchemas({ users: userSchema });

const db = createDatabase({
  uri: 'mongodb://127.0.0.1:27017',
  database: 'quick-start',
  schema,
});

await db.connect();

try {
  const user = await db.users.create({
    name: 'Ada Lovelace',
    email: 'ada@example.com',
    age: 36,
    password: 'not-returned-by-default',
  });

  const adults = await db.users.filter({ age: { $gte: 18 } });
  console.log(user, adults);
} finally {
  await db.disconnect();
}
```

The returned user is validated before insertion. The generated `_id` is an `ObjectId`, and `password` is not included in default query results.

## A Common Mistake

Do not execute queries before connecting:

```ts
const users = await db.users.filter(); // Throws: database is not connected
```

Create schemas and database handles during application setup, but connect before request handling or jobs begin.
