---
order: 5
---

# Mutations

Mongorm exposes `create`, `update`, and `delete` on models. `restore()` and `purge()` are also available on schemas configured with `softdelete: true`.

## Create

```ts
const user = await db.user.create({
  email: 'ada@example.com',
  name: 'Ada Lovelace',
});
```

Create validates the full input, generates a MongoDB `ObjectId`, inserts the document, and returns the created document.

## Update

```ts
const updated = await db.user.update({ _id: userId }, { name: 'Ada Byron Lovelace' });
```

The patch is partial and is parsed against the schema. The first matching document is updated with `$set`; the returned value is the updated document or `null` when no document matched.

Update is not a replacement operation. It does not remove fields omitted from the patch.

## Delete

```ts
const result = await db.user.delete({ _id: userId });
console.log(result.deletedCount);
```

On a normal schema, delete removes every document matching the filter. On a schema with `softdelete: true`, it sets `deletedAt` and leaves the document stored:

```ts
await db.user.delete({ _id: userId });
await db.user.restore({ _id: userId });
```

On schemas configured with soft deletes, `purge(filter)` permanently removes matching documents, including already soft-deleted documents. Unlike `delete()`, it does not preserve them for restoration. Use a precise filter.
