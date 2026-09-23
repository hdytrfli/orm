---
order: 1
---
# Getting Started

This section takes you from an empty TypeScript project to a working Mongorm data layer. It explains installation, connection ownership, the smallest useful schema, and the conventions used throughout the rest of the documentation.

## Recommended Path

1. Install `@mongorm/orm`.
2. Create a schema with `orm.schema()`.
3. Register the schemas with `orm.defineSchemas()`.
4. Create and connect a database handle with `createDatabase()`.
5. Query through the generated model.

## Pages

- [Installation](/getting-started/installation): packages, runtime requirements, and environment variables.
- [Quick Start](/getting-started/quick-start): a complete users-and-posts example.
- [Project Structure](/getting-started/project-structure): where schemas, connection code, and model access belong.
- [Runtime Lifecycle](/getting-started/lifecycle): connect, reuse, and close MongoDB resources safely.

## The Smallest Complete Example

```ts
import { createDatabase, orm } from '@mongorm/orm';

const schemas = orm.defineSchemas({
  user: orm.schema({
    email: orm.string().email(),
  }),
});

const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'app',
  schema: schemas,
});
await db.connect();
const user = await db.user.create({ email: 'ada@example.com' });
```
