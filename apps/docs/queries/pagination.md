---
order: 3
---

# Sorting, Limits, and Pagination

## Sorting

Sort keys are schema-derived and directions are `'asc'` or `'desc'`:

```ts
const posts = await db.post.find({ published: true }).sort({ publishedAt: 'desc' });
```

Use a stable sort for user-facing pagination. Cursor pagination uses `_id` ascending internally.

## Skip and Limit

```ts
const page = await db.post
  .find({ published: true })
  .sort({ publishedAt: 'desc' })
  .skip(40)
  .limit(20);
```

`skip()` and `limit()` require non-negative integers. Offset pagination is straightforward, but large offsets can become expensive because MongoDB must advance past skipped records.

## Cursor Streaming and Pagination

`.cursor()` uses the default `_id` ascending order. Without `.limit()`, it streams every matching document lazily in batches. This is suitable for exports because the full result set is not accumulated in memory:

```ts
const exportCursor = db.post.find({ published: true }).cursor();

for await (const post of exportCursor) {
  await writePostToExport(post);
}
```

To paginate through bounded pages, set a positive limit:

```ts
const query = db.post.find({ published: true }).limit(25);
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
  .find({ published: true })
  .limit(25)
  .cursor(cursor.next ?? undefined);
```

The cursor exposes a lazy async iterable. In page mode, it reads one extra document internally and updates `next` with the last `_id` when another page exists. Pass that token to the next limited query. In unbounded streaming mode, `next` remains `null`; the cursor is intended to be consumed to completion rather than resumed as a page.

## Cursor Restrictions

Cursor queries reject:

- A zero limit (omit `.limit()` to stream all matching documents).
- `skip()`.
- Custom sort specifications.
- Sorts other than the default `_id: 'asc'`.

If the product requires arbitrary ordering, use offset pagination or design a domain-specific cursor around a compound ordering key.
