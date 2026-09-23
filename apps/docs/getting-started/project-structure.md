---
order: 3
---

# Project Structure

A useful application separates schema design from connection lifecycle and business operations.

```text
src/
  db/
    schemas.ts       # schema and registry definitions
    database.ts      # createDatabase() and connection lifecycle
    index.ts         # shared db export
  modules/
    users/
      service.ts     # application operations
      routes.ts      # transport layer
  types/
    api.ts           # intentionally public DTO types
```

## `schemas.ts`

Keep schema objects at module scope. They are definitions, not per-request state.

```ts
export const schemas = orm
  .defineSchemas({ user, post })
  .defineRelations({ post: { authorId: 'user' } });
```

## `database.ts`

Own the connection in one place. `createDatabase()` creates and owns the underlying MongoDB client:

```ts
export const db = createDatabase({
  uri,
  database: databaseName,
  schema: schemas,
});
await db.connect();
export { client };
```

## Services

Services should express business operations rather than repeat connection setup:

```ts
export function listPublishedPosts() {
  return db.post.find({ published: true }).sort({ publishedAt: 'desc' }).limit(20);
}
```

## Keep Transport Types Deliberate

The stored document type is not always the same as an API response. Use `.select()` for simple projections and explicit DTO mapping when the public contract renames, combines, or redacts fields.
