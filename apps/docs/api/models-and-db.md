# Models and Database API

## `createDatabase(options)`

```ts
const db = createDatabase({
  uri: 'mongodb://127.0.0.1:27017',
  database: 'application',
  schema,
});
```

Registered schema keys become model properties:

```ts
db.users;
db.groups;
```

## `db.connect()` and `db.disconnect()`

```ts
await db.connect();
try {
  // Queries
} finally {
  await db.disconnect();
}
```

## `Model.create(input)`

Validates and inserts a document with a generated `_id`.

## `Model.filter(filter?)`

Builds a typed list query.

## `Model.find(filter?)`

Builds a typed single-document query. It resolves to a document or `null`.

## `Model.update(filter, patch)`

Validates a partial patch and updates the first matching document.

## `Model.delete(filter)`

Deletes all matching documents. Use a precise filter when deleting production data.
