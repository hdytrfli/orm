<p align="center">
  <img src="./.github/assets/backdrop.svg" alt="Mongorm" width="100%" style="border-radius: 10px;" />
</p>

<p align="center">
  TypeScript-first MongoDB ORM with a small, strongly typed API.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
</p>

Mongorm is a TypeScript-first MongoDB ORM for applications that want strong types and validation without hiding MongoDB behind a large abstraction.

It was created to make the common parts of MongoDB application development consistent: define data once, validate it at the boundary, query it with inferred types, and still keep access to MongoDB when the application needs it.

## Features

### Typed Schemas

Define the shape of your data once. Mongorm infers the input and output types from the schema and validates writes with Zod-backed fields.

```ts
const ROLES = ['admin', 'member'];

const userSchema = orm.schema({
  name: orm.string(),
  email: orm.string().email(),
  role: orm.enum(ROLES),
});
```

### Create, Read, Update, and Delete and Queries

Create records and build readable queries without losing MongoDB filter semantics.

```ts
const user = await db.users.create({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
  role: 'admin',
});

const users = await db.users
  .select(['name', 'email'])
  .find({ role: 'admin' })
  .sort({ name: 'asc' })
  .limit(20);
```

Use `.first()` when a query should return one record or `null`:

```ts
const user = await db.users.find({ email: 'ada@example.com' }).first();
```

### Relations and Population

Connect related records and load them only when needed.

```ts
const user = await db.users
  .find({ email: 'ada@example.com' })
  .populate([
    {
      ref: 'company',
      select: ['name'. 'address'],
    },
  ])
  .first();
```

### Bulk Operations

Use the same model for individual writes and larger batches.

```ts
await db.users.bulk.create([
  { name: 'Grace Hopper', email: 'grace@example.com', role: 'admin' },
  { name: 'Alan Turing', email: 'alan@example.com', role: 'member' },
]);
```

### Built-In Application Features

- Optional timestamps and soft deletes.
- Hidden fields for sensitive values.
- Reusable scopes for common read views.
- Explicit schema indexes with MongoDB options.
- Cursors, pagination, projections, sorting, and population.
- Access to the native collection for advanced MongoDB operations.

## Getting Started

```bash
pnpm add @mongorm/orm
```

```ts
import { createDatabase, orm } from '@mongorm/orm';

const ROLES = ['admin', 'member'];
const userSchema = orm
  .schema({
    email: orm.email(),
    role: orm.enum(ROLES),
    password: orm.string().hidden(),
  })
  .options({
    timestamps: true,
  });

const schema = orm.defineSchemas({
  users: userSchema,
});

const db = createDatabase({
  uri: process.env.MONGODB_URI,
  database: 'app',
  schema,
});

await db.connect();
await db.users.bulk.create([
  { email: 'grace@example.com', role: 'member', password: 'password' },
  { email: 'alan@example.com', role: 'admin', password: 'password' },
]);

const user = await db.users
  .find({ email: 'alan@example.com', role: 'admin' })
  .show(['password'])
  .first();

if (!user) throw new Error('User not found');
console.log(user);
```

Mongorm keeps the MongoDB driver close at hand, so it simplifies everyday work without limiting access to MongoDB's full feature set.

## License

MIT
