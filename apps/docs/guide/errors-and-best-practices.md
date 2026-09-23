# Errors and Best Practices

## Error Types

Mongorm exports an error hierarchy:

- `OrmError`: base class for ORM errors.
- `DatabaseNotConnectedError`: a query was attempted before connecting.
- `InvalidQueryError`: an unsupported query combination was requested.
- `CursorQueryError`: cursor requirements were violated.
- `EstimatedCountError`: an estimated count was requested with filters.

```ts
try {
  await db.users.filter({ role: 'admin' }).count(true);
} catch (error) {
  if (error instanceof EstimatedCountError) {
    // Use count() when a filtered exact count is required.
  }
}
```

## Recommended Project Structure

```text
src/
  schema/
    user.ts
    group.ts
    company.ts
    index.ts
  db.ts
  services/
    users.ts
```

Keep individual field definitions separate. Assemble relations and scopes in the registry module to avoid circular imports and to give the complete schema graph to TypeScript.

## Connection Lifecycle

Create one database handle for the process and reuse it. Connect during application startup and disconnect during graceful shutdown.

Do not create a new `MongoClient` per request.

## Validation Boundaries

Validate external input with `schema.parse()` or `safeParse()` before writes. Query filters and update patches are type-checked at compile time, but runtime validation remains important for untyped JavaScript callers and deserialized data.

## Projection Discipline

Select only the fields needed by a service or endpoint. Keep passwords and tokens hidden. Prefer named scopes for repeated response shapes so projection decisions are reviewed in one place.

## Population Discipline

Population is a database read decision, not a default serialization step. Avoid populating large graphs by default. Use explicit scopes and bounded depth for list endpoints.
