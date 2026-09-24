---
order: 7
---

# Schema Indexes

Declare MongoDB indexes on a schema with `.indexes()`. Mongorm does not create or change indexes just because a schema is registered; call `db.sync()` after connecting.

## 1. Declare the access pattern

Choose fields based on the filters and sorts the application actually uses. Field names and index directions are checked against the schema.

```ts
const user = orm
  .schema({ tenantId: orm.objectId(), email: orm.email(), status: orm.string() })
  .indexes([
    { fields: { tenantId: 1, email: 1 }, options: { unique: true, name: 'user_email_per_tenant' } },
    { fields: { tenantId: 1, status: 1 } },
  ]);
```

Compound field order matters in MongoDB. Put the equality/sort pattern that matches the actual workload first; validate choices with MongoDB query plans.

## 2. Configure unique and partial indexes

Index `options` accepts MongoDB index options, including `unique`, `name`, `sparse`, `partialFilterExpression`, and TTL options. Partial filters are checked against the schema and use the same filter/operator types as `find()`.

```ts
const account = orm
  .schema({ email: orm.email() })
  .options({ softdelete: true })
  .indexes([
    {
      fields: { email: 1 },
      options: {
        name: 'active_account_email',
        unique: true,
        partialFilterExpression: { deletedAt: null },
      },
    },
  ]);
```

For an optional unique field, include an `$exists` condition so missing values are excluded. A compound sparse index includes a document when any indexed field exists; `sparse` alone may not exclude documents when another indexed key is always present. For an optional username that should be unique per tenant only among active users:

```ts
const user = orm
  .schema({ tenantId: orm.objectId(), username: orm.string().optional() })
  .options({ softdelete: true })
  .indexes([
    {
      fields: { tenantId: 1, username: 1 },
      options: {
        name: 'active_username_per_tenant',
        unique: true,
        partialFilterExpression: {
          $and: [{ username: { $exists: true } }, { deletedAt: null }],
        },
      },
    },
  ]);
```

MongoDB only permits a subset of query operators in partial-index filters. Use operators supported by your MongoDB server version; the schema-aware TypeScript filter does not override server restrictions.

For soft-delete schemas, add a `deletedAt` condition to unique indexes when deleted records should release their unique values. This is a design choice: omit it when deleted records must continue reserving those values.

## 3. Create indexes

```ts
await db.connect();
const result = await db.sync();
```

`sync()` creates declared indexes and returns created/existing index names by collection. By default it does not remove existing indexes or alter their options.

## 4. Replace or drop indexes deliberately

To drop all non-`_id` indexes in registered collections before recreating declared indexes:

```ts
await db.sync({ dropIndexes: true });
```

This is destructive to undeclared indexes too. Use it only when that reset is intended. For one collection, explicitly named schema indexes can be dropped with typed names:

```ts
await db.users.index.drop(['user_email_per_tenant']);
await db.users.index.purge(); // all non-_id indexes for this collection
```

Unnamed indexes cannot be passed to `.index.drop()`. Give indexes a stable `options.name` when they need individual management. Index changes that conflict with an existing MongoDB specification require dropping the old index before recreating it.
