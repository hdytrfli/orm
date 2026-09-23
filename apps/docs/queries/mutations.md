---
order: 5
---

# Mutations

Mongorm exposes `create`, `update`, and `delete` on models.

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

Use `purge()` to permanently remove matching documents, including documents already soft-deleted. Always use a precise filter for production data and consider requiring an explicit confirmation for broad administrative operations.

## Mutation Transactions

Mongorm's model methods target individual collection operations. If a business operation must update multiple documents atomically, use the MongoDB driver's session and transaction APIs at the application boundary and keep the invariants in the service layer.
