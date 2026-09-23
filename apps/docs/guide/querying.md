# Querying

Models expose `filter()` for list queries and `find()` for the first matching document.

```ts
const users = await db.users.filter({
  role: 'admin',
  age: { $gte: 18 },
});

const user = await db.users.find({ email: 'ada@example.com' });
```

Both methods accept MongoDB-style filters constrained by the inferred document type.

## Logical Operators

```ts
const users = await db.users.filter({
  $or: [
    { role: 'admin' },
    { age: { $gte: 65 } },
  ],
});
```

Unknown fields and invalid operator values are rejected by TypeScript.

## Sorting, Skipping, and Limiting

```ts
const users = await db.users
  .filter({ role: 'member' })
  .sort({ age: 'asc' })
  .skip(10)
  .limit(20);
```

MongoDB does not guarantee natural order. Add an explicit sort whenever order matters. Cursor pagination uses `_id` ascending order.

## Create, Update, Delete

```ts
const created = await db.users.create({
  name: 'Ada Lovelace',
  email: 'ada@example.com',
});

const updated = await db.users.update(
  { _id: created._id },
  { name: 'Ada Byron Lovelace' },
);

const deleted = await db.users.delete({ _id: created._id });
```

`create()` validates a complete document. `update()` validates a partial patch. `delete()` removes every matching document, so always use a deliberate filter.
