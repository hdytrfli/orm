---
order: 2
---

# Quick Start

This example builds a small blog with users, posts, a relation, a hidden credential, a named scope, and a typed query.

## 1. Define Schemas

```ts
import { orm } from '@mongorm/orm';

const user = orm.schema({
  email: orm.string().email(),
  name: orm.string().min(1),
  passwordHash: orm.string().hidden(),
});

const post = orm.schema({
  title: orm.string().min(1),
  body: orm.string(),
  authorId: orm.objectId(),
  published: orm.boolean().default(false),
});
```

`orm.objectId()` is a Zod-compatible field that validates MongoDB `ObjectId` values. The `passwordHash` field is stored and validated but excluded from normal results.

## 2. Register Relations

```ts
const schemas = orm
  .defineSchemas({ user, post })
  .defineRelations({
    post: { authorId: 'user' },
  })
  .defineScopes({
    post: {
      detail: [
        {
          ref: 'author',
          select: ['name', 'email'],
        },
      ],
    },
  });
```

The relation name is the local field name. A post's `authorId` points to the `_id` of a user, so `post` gains an `author` population key.

## 3. Create the Database Handle

```ts
import { createDatabase } from '@mongorm/orm';

const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'blog',
  schema: schemas,
});
await db.connect();
```

The generated model names are the registry keys, so this registry exposes `db.user` and `db.post`.

## 4. Write Data

```ts
const ada = await db.user.create({
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  passwordHash: 'hashed-value',
});

const post = await db.post.create({
  title: 'A typed document layer',
  body: 'MongoDB and TypeScript can work together.',
  authorId: ada._id,
});
```

`create()` parses the input before insertion and generates `_id`. Invalid values fail before MongoDB receives the document.

## 5. Read Data

```ts
const result = await db.post
  .filter({ published: true })
  .with('detail')
  .select(['title', 'author.name']);
```

The result contains `_id`, `title`, and the selected author projection. The scope and selection are reflected in the inferred TypeScript result.

## 6. Close the Client

```ts
await client.close();
```

In an HTTP server, close the client during graceful shutdown rather than after each request.
