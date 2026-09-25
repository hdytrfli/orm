---
order: 2
---

# Query Fundamentals

Models expose one read-query builder:

- `find(filter?)` accepts an optional MongoDB-style filter and returns an awaitable query resolving to an array of matching documents.
- Chain `.first()` on that query to resolve to one matching document or `null`.

The filter is constrained by the schema's field types.

```ts
const activeUsers = await db.user.find({ active: true });
const user = await db.user.find({ email: 'ada@example.com' });
```

## Soft-Delete Queries

Schemas configured with `softdelete: true` automatically add `{ deletedAt: null }` to normal reads:

```ts
const activeUsers = await db.user.find({});
const allUsers = await db.user.find({}).deleted('include');
const deletedUsers = await db.user.find({}).deleted('only');
```

This applies to `find()` and to `.first()` because it is terminal on the same query. Use the explicit methods instead of manually repeating a `deletedAt` predicate so the intent remains clear.

## Queries Are Awaitable

The builders implement `PromiseLike`, so `await` executes the query:

```ts
const users = await db.user.find({ role: 'admin' }).sort({ createdAt: 'desc' }).limit(50);
```

Keep query construction close to the operation that executes it. A query can be passed through a service boundary, but do not accidentally retain a builder when the function contract promises data.

## MongoDB Operators

Field conditions use MongoDB driver condition types:

```ts
const users = await db.user.find({
  age: { $gte: 18, $lt: 65 },
  $or: [{ role: 'admin' }, { role: 'moderator' }],
});
```

The schema constrains field names and values, while MongoDB supplies operators such as `$in`, `$exists`, `$regex`, `$and`, and `$or`.

## Nested Field Filters

When the schema contains these nested fields, use MongoDB dot notation to filter one field inside the object. The path is checked against the schema and remains type-safe:

```ts
const LondonUsers = await db.user.find({
  'profile.location.city': { $eq: 'London' },
});
```

The same form works with other operators:

```ts
const usersWithPublicProfiles = await db.user.find({
  'profile.website': { $exists: true },
});
```

Filtering the parent field instead matches the embedded document as a whole, so use dot notation when other nested fields should remain unconstrained.

## Empty Filters

An omitted or empty filter matches every document:

```ts
await db.user.find();
await db.user.find({});
```

Use an explicit safety check before destructive operations. `delete()` intentionally accepts a filter and deletes all matching documents.

## Single Versus Many

Use `find()` for lists, including when an empty result is normal. Add `.first()` when the application needs at most one result; it returns `null` when no document matches.
