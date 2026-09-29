---
order: 3
---

# Database and Models API

## `createDatabase(options)`

Creates a disconnected database handle and exposes registered schemas as model properties.

```ts
const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'application',
  schemas,
});
await db.connect();
```

## `Db.connect()`

Connects the owned MongoDB client and selects the configured database. Queries before connection fail with `DatabaseNotConnectedError`.

## `Db.disconnect()`

Closes the client and clears the active database reference.

## `Db.native`

Returns the connected native MongoDB `Db`. This is an escape hatch for driver features not currently wrapped by Mongorm, such as aggregation pipelines, change streams, specialized bulk writes, and transactions. It throws `DatabaseNotConnectedError` until `connect()` completes.

Native operations bypass Mongorm's model-level validation, default projections, soft-delete filters, population, and inferred result types. See [Escape Hatches](/guides/escape-hatches) for examples and guidance on keeping those boundaries safe.

## `Db.model(name, schema)`

Creates a model bound to a collection name and schema. Registered schemas are normally accessed through generated model properties instead.

## `Model.features`

Every model exposes a frozen `features` object describing capabilities and declarations from its schema:

```ts
const features = db.users.features;

features.timestamps; // whether managed timestamps are enabled
features.softdelete; // whether soft deletion is enabled
features.relations; // declared relation names
features.scopes; // declared population scope names
features.virtuals; // declared virtual relation names
features.indexes; // declared index definitions
features.searchables; // configured local and related string paths
```

The flags are `true` or `false`. The names in `relations`, `scopes`, and `virtuals` preserve their schema-derived literal types. `indexes` contains the declared index definitions, including definitions without an explicit name. `searchables` lists the configured local and related string paths. These values describe schema configuration; they do not connect to MongoDB or report which indexes currently exist in the database.

Use `features.indexes` to inspect declared index metadata (`fields` and optional MongoDB index options). Use `model.index.drop()` and `model.index.purge()` to perform index operations. See [Schema Indexes](/schemas/indexes) for declaration and synchronization details.

## `Model.create(input)`

Parses a complete input, generates `_id`, inserts one document, and returns the created document.

## `Model.bulk.create(inputs)`

Validates and inserts multiple documents with one MongoDB `insertMany` operation. Each document receives the same generated fields as `create()`, and the created documents are returned in input order.

## `Schema.indexes(definitions)` and `Db.sync()`

See [Schema Indexes](/schemas/indexes) for field directions, MongoDB options, optional-field and soft-delete index patterns, and index reset behavior.

Declare typed MongoDB indexes on a schema, then explicitly create them after connecting:

```ts
const userSchema = orm
  .schema({ email: orm.string(), tenantId: orm.string() })
  .indexes([
    { fields: { tenantId: 1, email: 1 } },
    { fields: { email: 1 }, options: { unique: true } },
  ]);

await db.connect();
await db.sync();
```

Index creation is explicit and is not triggered by model access. To remove all existing
non-`_id` indexes before recreating declared indexes, opt in explicitly:

```ts
await db.sync({ dropIndexes: true });
```

Indexes with an explicit `options.name` can also be managed for one collection:

```ts
await db.users.index.drop(['user_email_unique']);
await db.users.index.purge();
```

`index.drop()` is type-safe and only accepts names declared on the schema. `index.purge()`
drops all non-`_id` indexes for that collection.

## `Model.find(filter?)`

Builds a list query resolving to an array. The filter defaults to `{}`. Chain `.first()` at the end when one document is needed.

## `Model.update(filter, patch)`

Parses a partial patch, applies `$set` to the first matching document, and returns the updated document or `null`.

## `Model.upsert(filter, data)`

Atomically inserts a document when no active match exists, or applies `data` to the match. Equality
fields in `filter` seed the inserted document, so they do not need to be repeated in `data`. The
filter must contain equality values rather than operators such as `$gt` or `$or`; `data` must provide
the remaining required create fields. The created or updated document is returned.

```ts
const user = await db.users.upsert({ email: 'ada@example.com' }, { name: 'Ada' });
```

## `Model.delete(filter)`

Deletes all matching documents and returns MongoDB's `DeleteResult`. For a soft-delete schema, it marks active matching documents with `deletedAt` instead.

## `Model.restore(filter)`

Restores the first matching soft-deleted document by setting `deletedAt` to `null`.

## `Model.purge(filter)`

Permanently deletes all matching documents, including soft-deleted documents.
