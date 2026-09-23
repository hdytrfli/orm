---
order: 1
---

# Application Architecture

Use Mongorm as the persistence layer inside a service boundary. Route handlers should not need to know how MongoDB clients are initialized or how relation graphs are wired.

## Recommended Layers

1. **Transport** validates request shape and translates HTTP or RPC concerns.
2. **Service** applies business rules and chooses a query shape.
3. **Mongorm model** validates mutations and performs persistence.
4. **MongoDB** stores documents and executes filters.

```ts
export async function getPublicUser(id: ObjectId) {
  return db.user.find({ _id: id }).select(['name', 'avatarUrl']);
}
```

## Keep Registry Construction Central

Build the registry once. Scattering relation definitions across feature modules makes it difficult to understand available population paths and can create import cycles.

## Prefer Intent-Revealing Services

`listPublishedPosts()` is easier to audit than repeating a broad query in every route. Services are also a natural place to choose scopes, projections, authorization filters, and pagination policy.

## Avoid a Generic Repository Wrapper

Mongorm already provides typed model operations. A wrapper that accepts arbitrary strings and returns `unknown` often throws away the schema information. Add a service for business intent, not another generic CRUD abstraction.
