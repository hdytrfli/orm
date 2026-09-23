# Introduction

Mongorm is a TypeScript-first MongoDB ORM for applications that want Zod validation, inferred document types, and a small query API without hiding MongoDB’s core model.

The package is published as `@mongorm/orm`.

## Design Goals

Mongorm is intentionally built around a few principles:

- Zod remains the source of truth for validation and field inference.
- MongoDB remains visible. Filters, projections, ObjectIds, and cursor pagination follow MongoDB concepts.
- Query methods are typed from the schema instead of accepting arbitrary strings.
- Relations and scopes are declared explicitly rather than inferred from naming conventions.
- Runtime behavior and compile-time behavior should agree. Unsupported combinations should fail early.

## The Core Flow

Most applications follow this flow:

1. Define independent Zod-backed schemas.
2. Register those schemas with plural model names.
3. Define relations and reusable population scopes on the registry.
4. Create a database handle.
5. Connect before executing database operations.
6. Use `db.users`, `db.groups`, and other registered models.

```ts
import { createDatabase, orm } from '@mongorm/orm';

const users = orm.schema({
  name: orm.string(),
  age: orm.number(),
});

const schema = orm.defineSchemas({ users });

const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'application',
  schema,
});

await db.connect();
const adults = await db.users.filter({ age: { $gte: 18 } });
await db.disconnect();
```

## What Mongorm Is Not

Mongorm does not attempt to replace MongoDB’s document model with a relational abstraction. It does not automatically join every relation, silently mutate projections, or generate migrations from arbitrary schema changes. Explicitness is preferred over surprising behavior.
