---
order: 3
---

# Queries

Mongorm queries are lazy, typed builders. A query is assembled synchronously and executed when awaited or iterated. This makes it easy to compose filters, sorting, limits, projections, and population in a readable order.

## Pages

- [Query Fundamentals](/queries/fundamentals): `filter()`, `find()`, awaitability, and MongoDB filters.
- [Selection and Projection](/queries/selection): safe field selection, nested paths, and hidden fields.
- [Sorting, Limits, and Pagination](/queries/pagination): offset pagination and cursor pagination.
- [Population](/queries/population): explicit and nested relation loading.
- [Mutations](/queries/mutations): create, update, and delete behavior.
- [Counts](/queries/counts): exact and estimated counts.

## A Query Is Data Access Policy

```ts
const page = await db.post
  .find({ status: 'published', authorId: authorId })
  .sort({ publishedAt: 'desc' })
  .select(['title', 'slug', 'publishedAt'])
  .limit(20);
```

The same chain also determines the result type. Adding `.select()` removes fields from the TypeScript result; adding `.populate()` adds typed related documents.
