---
order: 5
---

# Counts

Call `.count()` on a list query to count documents matching its filter.

```ts
const activeCount = await db.user.find({ active: true }).count();
```

The default is an exact `countDocuments()` operation and respects the query filter.

## Estimated Count

```ts
const approximateTotal = await db.user.find().count(true);
```

Passing `true` uses MongoDB's estimated collection count. It is fast and useful for approximate collection totals, but it cannot be combined with a filter. On a soft-delete schema, the default active-only mode is also a filter, so opt into all documents when the estimate should cover the whole collection:

```ts
const approximateTotal = await db.user.find().deleted('include').count(true);
```

Mongorm rejects filtered estimated counts instead of silently returning a misleading number.

## Choosing a Count

- Use exact counts for filtered pagination metadata, billing, permissions, and user-visible numbers that must be correct.
- Use estimated counts for broad, approximate collection statistics.
- Avoid running an exact count automatically for every list endpoint if the endpoint does not need totals.
