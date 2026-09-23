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

## `Model.filter(filter?)`

Builds a list query resolving to an array. The filter defaults to `{}`.

## `Model.find(filter?)`

Builds a single-document query resolving to a document or `null`.

## `Model.update(filter, patch)`

Parses a partial patch, applies `$set` to the first matching document, and returns the updated document or `null`.

## `Model.delete(filter)`

Deletes all matching documents and returns MongoDB's `DeleteResult`.
