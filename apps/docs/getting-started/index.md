---
order: 1
---

# Getting Started

Follow these steps in order to connect Mongorm to MongoDB, declare a schema, write a document, and query it. The walkthrough uses the MongoDB Node.js driver through Mongorm; it does not require a web framework.

## Recommended Path

1. Install `@mongorm/orm` and configure a MongoDB URI.
2. Define and register schemas.
3. Create the database handle and connect once.
4. Create a document and read it with a typed query.
5. Disconnect when the process shuts down.

## Pages

- [Installation](/getting-started/installation): packages, runtime requirements, and environment variables.
- [Quick Start](/getting-started/quick-start): a complete users-and-posts example.
- [Runtime Lifecycle](/getting-started/lifecycle): connect, reuse, and close MongoDB resources safely.

## The Smallest Complete Example

```ts
import { createDatabase, orm } from '@mongorm/orm';

const schemas = orm.defineSchemas({
  user: orm.schema({
    email: orm.email(),
  }),
});

const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'app',
  schemas,
});
await db.connect();
const user = await db.user.create({ email: 'ada@example.com' });
```
