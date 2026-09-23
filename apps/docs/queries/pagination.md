---
order: 3
---

# Sorting, Limits, and Pagination

## Sorting

Sort keys are schema-derived and directions are `'asc'` or `'desc'`:

```ts
const posts = await db.post.filter({ published: true }).sort({ publishedAt: 'desc' });
```

Use a stable sort for user-facing pagination. Cursor pagination uses `_id` ascending internally.

## Skip and Limit

```ts
const page = await db.post
  .filter({ published: true })
  .sort({ publishedAt: 'desc' })
  .skip(40)
  .limit(20);
```

`skip()` and `limit()` require non-negative integers. Offset pagination is straightforward, but large offsets can become expensive because MongoDB must advance past skipped records.

## Cursor Pagination

Cursor pagination requires a positive limit and uses the default `_id` ascending order:

```ts
const query = db.post.filter({ published: true }).limit(25);
const cursor = query.cursor();
const documents = [];

for await (const document of cursor) {
  documents.push(document);
}

const next = cursor.next;
```

Request the next page by passing the returned ObjectId:

```ts
const nextPage = db.post
  .filter({ published: true })
  .limit(25)
  .cursor(cursor.next ?? undefined);
```

The cursor exposes a lazy async iterable and updates `next` after iteration. It reads one extra document internally to determine whether another page exists.

## Cursor Restrictions

Cursor queries reject:

- Missing or zero limits.
- `skip()`.
- Custom sort specifications.
- Sorts other than the default `_id: 'asc'`.

If the product requires arbitrary ordering, use offset pagination or design a domain-specific cursor around a compound ordering key.
