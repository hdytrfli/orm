---
layout: home
hero:
  name: Mongorm
  text: Type-safe MongoDB. Explicit writes.
  tagline: Define your data once, query it with inferred types, and persist changes through clear operations—not hidden document mutation or save hooks.
  image:
    src: /logo.svg
    alt: Mongorm
  actions:
    - theme: brand
      text: Start building
      link: /getting-started/
    - theme: alt
      text: Explore the schemas
      link: /schemas/
features:
  - title: Schema-derived type safety
    details: Define validation once with Zod, then infer document, input, and query result types from the schema.
  - title: Explicit persistence operations
    details: Query results are ordinary values. Persist changes through validated model operations, with no implicit save behavior.
  - title: Native MongoDB semantics
    details: Work with MongoDB documents, filters, ObjectIds, and indexes without replacing them with a relational abstraction.
  - title: Controlled query results
    details: Use typed projections, hidden fields, relations, and population scopes to make loaded data explicit.
---

## Writes Are Explicit

Mongorm does not use a mutable document plus `.save()` workflow. A returned object is an ordinary query result, not a persistence handle; changing it locally does not update MongoDB. Persist a change with a model operation that makes the target and patch visible:

```ts
const user = await db.user.find({ _id: userId }).first();

if (user) {
  user.name = 'Ada Byron Lovelace'; // local JavaScript change only
  await db.user.update({ _id: user._id }, { name: user.name });
}
```

The database write is explicit, validated against the schema, and easy to locate during review. Mongorm does not track dirty fields or persist arbitrary object mutations behind a `.save()` call.

## The Mongorm Mental Model

Mongorm has four layers:

1. **Schemas** describe and validate documents.
2. **Registries** connect schemas, relations, and reusable scopes.
3. **Models** bind schemas to MongoDB collections.
4. **Queries** turn typed intent into MongoDB operations and typed results.

```ts
import { createDatabase, orm } from '@mongorm/orm';

const user = orm.schema({
  email: orm.email(),
  name: orm.string(),
  passwordHash: orm.string().hidden(),
});

const schemas = orm.defineSchemas({ user });
const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'app',
  schemas,
});
await db.connect();

const admins = await db.user.find({ email: { $regex: '@example.com$' } }).select(['email', 'name']);
```

## Follow the Documentation

- **New to Mongorm?** Start with [Getting Started](/getting-started/), then complete the [Quick Start](/getting-started/quick-start).
- **Defining collections?** Read [Schemas](/schemas/), then [Relations and Registries](/schemas/relations) and [Schema Indexes](/schemas/indexes).
- **Reading and writing documents?** Follow [Queries](/queries/) and [TypeScript](/typescript/) for result inference.
- **Looking for a method?** Use the [API Reference](/reference/).

## Keep Data Access Explicit

Mongorm keeps MongoDB's document and filter semantics while adding schema validation and inferred types. Query results are ordinary values, and changes are persisted through explicit model operations rather than implicit document state.
