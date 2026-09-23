---
layout: home
hero:
  name: Mongorm
  text: Typescript first MongoDB Client
  tagline: A schema-first TypeScript ORM for teams that want MongoDB flexibility without giving up reliable contracts.
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
  - title: Native Zod schemas
    details: Use familiar Zod constructors directly through orm, with validation and inference in one definition.
  - title: Safe by default
    details: Hidden fields, typed filters, typed projections, and explicit population keep accidental data exposure difficult.
  - title: MongoDB underneath
    details: Keep MongoDB's document model and query capabilities while gaining a small, composable application API.
  - title: Relations without magic
    details: Declare relation graphs centrally, then opt into explicit or named population with nested type inference.
  - title: Practical CRUD
    details: Create, filter, find, update, delete, count, paginate, select, and populate through one consistent model surface.
  - title: TypeScript first
    details: Query result types change as you select fields, show hidden fields, or populate related documents.
---

## The Mongorm Mental Model

Mongorm has four layers:

1. **Schemas** describe and validate documents.
2. **Registries** connect schemas, relations, and reusable scopes.
3. **Models** bind schemas to MongoDB collections.
4. **Queries** turn typed intent into MongoDB operations and typed results.

```ts
import { createDatabase, orm } from '@mongorm/orm';

const user = orm.schema({
  email: orm.string().email(),
  name: orm.string(),
  passwordHash: orm.string().hidden(),
});

const schemas = orm.defineSchemas({ user });
const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'app',
  schema: schemas,
});
await db.connect();

const admins = await db.user.find({ email: { $regex: '@example.com$' } }).select(['email', 'name']);
```

## Follow The Documentation

- **New to Mongorm?** Start with [Getting Started](/getting-started/), then complete the [Quick Start](/getting-started/quick-start).
- **Designing a data layer?** Read [Schemas](/schemas/) before [Relations and Registries](/schemas/relations).
- **Writing endpoints?** Go to [Queries](/queries/) and then [TypeScript](/typescript/) for result inference patterns.
- **Looking for a method?** Use the [API Reference](/reference/).

## What Mongorm Does Not Hide

Mongorm does not pretend MongoDB is relational SQL. Documents remain documents, filters remain MongoDB filters, and collection behavior remains visible. The library focuses on the boundaries where application bugs tend to appear: validation, accidental field exposure, inconsistent relation loading, and drifting TypeScript types.
