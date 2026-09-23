---
order: 1
---

# Query Fundamentals

Models expose two read builders:

- `filter()` returns an array of matching documents.
- `find()` returns the first matching document or `null`.

Both accept MongoDB-style filters constrained by the schema's field types.

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

This applies to both `filter()` and `find()`. Use the explicit methods instead of manually repeating a `deletedAt` predicate so the intent remains clear.

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

## Empty Filters

An omitted or empty filter matches every document:

```ts
await db.user.find();
await db.user.find({});
```

Use an explicit safety check before destructive operations. `delete()` intentionally accepts a filter and deletes all matching documents.

## Single Versus Many

Use `find()` when the application needs at most one result. Use `filter()` when an empty result is a normal list outcome. Neither method invents a missing document; `find()` returns `null`.
