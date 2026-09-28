---
order: 2
---

# Schema Fundamentals

The primary schema constructor is `orm.schema(shape)`. The shape is a record of Zod schemas. Mongorm retains the Zod behavior while adding MongoDB-aware fields and ORM metadata.

```ts
const user = orm.schema({
  email: orm.email(),
  displayName: orm.string(),
  active: orm.boolean().default(true),
});
```

## Managed Persistence Options

Add built-in lifecycle fields after defining the document shape. These options change persistence/query behavior; they are not ordinary fields you need to add to the shape:

```ts
const user = orm
  .schema({
    email: orm.email(),
    name: orm.string(),
  })
  .options({
    timestamps: true,
    softdelete: true,
  });
```

The supported options are:

| Option        | Default | Effect                                                                                               |
| ------------- | ------- | ---------------------------------------------------------------------------------------------------- |
| `timestamps`  | `false` | Adds and manages `createdAt` and `updatedAt`.                                                        |
| `softdelete`  | `false` | Adds `deletedAt`; ordinary reads exclude deleted documents and `delete()` marks rather than removes. |
| `hideManaged` | `false` | Marks enabled managed fields hidden from default query projections.                                  |

Pass all options in a single `.options({...})` call. A second call throws; combine the options instead. If timestamps are enabled, do not declare `createdAt` or `updatedAt` yourself. If soft deletion is enabled, do not declare `deletedAt` yourself; Mongorm rejects those collisions.

`timestamps: true` adds `createdAt` and `updatedAt` dates. Mongorm sets both on creation and refreshes `updatedAt` on updates and soft deletion. `softdelete: true` adds nullable `deletedAt`, hides deleted documents from normal queries, and makes `delete()` mark documents as deleted instead of removing them.

Managed fields are optional in create and update input, but always present in the persisted document type. Mongorm supplies missing values and refreshes lifecycle values when appropriate. Use `deleted('include')` to include deleted documents, `deleted('only')` to inspect the deleted set, `restore()` to recover a document, and `purge()` for permanent removal.

To omit managed timestamps and soft-delete metadata from normal query results, enable `hideManaged`:

```ts
const user = orm
  .schema({
    email: orm.email(),
  })
  .options({
    timestamps: true,
    softdelete: true,
    hideManaged: true,
  });

const users = await db.users.find(); // createdAt, updatedAt, deletedAt are omitted
const withLifecycle = await db.users.find().fields(['$all', '+createdAt', '+deletedAt']);
```

`hideManaged` only changes default query projections. `create()`, `update()`, and `restore()` return the full document because they do not have a projection chain.

`.hidden()` on a user-defined field is a separate choice; it hides that field by default whether or not `hideManaged` is enabled. See [Hidden Fields](/schemas/hidden-fields) for explicit access and security limitations.

## Schema Configuration Flow

A typical application defines the shape first, then persistence options, indexes, and finally relations/scopes in a registry:

```ts
const user = orm
  .schema({
    email: orm.email(),
    passwordHash: orm.string().hidden(),
    profile: orm.object({
      city: orm.string(),
    }),
  })
  .options({
    timestamps: true,
    softdelete: true,
    hideManaged: true,
  })
  .indexes([
    {
      fields: {
        email: 1,
      },
      options: {
        unique: true,
        name: 'user_email_unique',
      },
    },
  ]);
```

Schemas do not implicitly create database indexes or load related data. Indexes are created with `db.sync()` after connecting; relations and virtuals are loaded explicitly through query methods or named scopes. See [Schema Indexes](/schemas/indexes), [Registries and Relations](/schemas/relations), [Virtual Fields](/schemas/virtuals), and [Population Scopes](/schemas/scopes).

## Parsing and Inference

The schema parses input at write boundaries and supplies the source for inferred types.

```ts
const input = user.parse({
  email: 'ada@example.com',
  displayName: 'Ada',
});

// input.active is true because the schema default was applied.
```

Application code normally calls `model.create()` instead of calling `parse()` manually. Direct parsing is useful for validating request payloads before business logic.

## Optional, Nullable, and Default

These distinctions are important in MongoDB:

```ts
const profile = orm.schema({
  nickname: orm.string().optional(), // may be absent
  biography: orm.string().nullable(), // may be null
  timezone: orm.string().default('UTC'), // filled when absent
});
```

Do not use `optional()` when the application needs an explicit `null`. Do not use a default to conceal a missing required business value.

## Objects and Arrays

```ts
const order = orm.schema({
  shipping: orm.object({
    line1: orm.string(),
    city: orm.string(),
    postalCode: orm.string(),
  }),
  items: orm.array(
    orm.object({
      sku: orm.string(),
      quantity: orm.number().int().positive(),
    }),
  ),
});
```

Nested fields can be selected using dot paths when querying. The TypeScript result preserves the nested structure.

## Unknown Keys

Choose Zod object behavior deliberately. If a document must be controlled tightly, use a strict object schema. If MongoDB documents intentionally carry extension fields, model that extension explicitly rather than relying on accidental passthrough behavior.
