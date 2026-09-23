---
order: 3
---
# Reusable Application Types

Most code should derive types from schemas and query results. Add named aliases at module boundaries when they improve readability.

## Schema-Derived Types

```ts
type UserDocument = Awaited<ReturnType<typeof db.user.find>>;
```

For public API contracts, prefer a query that already selects the intended fields:

```ts
async function listUsers() {
  return db.user
    .filter({ active: true })
    .select(['name', 'email'])
    .limit(50);
}

type UserListItem = Awaited<ReturnType<typeof listUsers>>[number];
```

This keeps the DTO aligned with the actual query.

## Service Return Types

```ts
export async function findUser(id: ObjectId) {
  return db.user
    .find({ _id: id })
    .select(['name', 'email']);
}
```

Let TypeScript infer the service return when the query is the contract. Add an explicit return type when the service intentionally maps to a different shape.

## Mapping to DTOs

Use mapping for renaming or combining fields:

```ts
const user = await db.user.find({ _id: id }).select(['name', 'email']);
if (!user) return null;

return {
  displayName: user.name,
  contact: user.email,
};
```

Do not expose the full stored document just because it is convenient.
