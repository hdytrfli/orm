---
order: 2
---

# Database and Models API

## `createDatabase(options)`

Creates a disconnected database handle and exposes registered schemas as model properties.

```ts
const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'application',
  schema: schemas,
});
await db.connect();
```

## `Db.connect()`

Connects the owned MongoDB client and selects the configured database. Queries before connection fail with `DatabaseNotConnectedError`.

## `Db.disconnect()`

Closes the client and clears the active database reference.

## `Db.model(name, schema)`

Creates a model bound to a collection name and schema. Registered schemas are normally accessed through generated model properties instead.

## `Model.create(input)`

Parses a complete input, generates `_id`, inserts one document, and returns the created document.

## `Model.bulk.create(inputs)`

Validates and inserts multiple documents with one MongoDB `insertMany` operation. Each document receives the same generated fields as `create()`, and the created documents are returned in input order.

## `Model.find(filter?)`

Builds a list query resolving to an array. The filter defaults to `{}`. Chain `.first()` at the end when one document is needed.

## `Model.update(filter, patch)`

Parses a partial patch, applies `$set` to the first matching document, and returns the updated document or `null`.

## `Model.delete(filter)`

Deletes all matching documents and returns MongoDB's `DeleteResult`. For a soft-delete schema, it marks active matching documents with `deletedAt` instead.

## `Model.restore(filter)`

Restores the first matching soft-deleted document by setting `deletedAt` to `null`.

## `Model.purge(filter)`

Permanently deletes all matching documents, including soft-deleted documents.
