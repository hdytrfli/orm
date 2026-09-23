---
order: 1
---
# Schema Fundamentals

The primary schema constructor is `orm.schema(shape)`. The shape is a record of Zod schemas. Mongorm retains the Zod behavior while adding MongoDB-aware fields and ORM metadata.

```ts
const user = orm.schema({
  email: orm.string().email(),
  displayName: orm.string(),
  active: orm.boolean().default(true),
});
```

## Managed Persistence Options

Add built-in lifecycle fields after defining the document shape:

```ts
const user = orm
  .schema({
    email: orm.string().email(),
    name: orm.string(),
  })
  .options({ timestamps: true, softDelete: true });
```

`timestamps: true` adds `createdAt` and `updatedAt` dates. Mongorm sets both on creation and refreshes `updatedAt` on updates and soft deletion. `softDelete: true` adds nullable `deletedAt`, hides deleted documents from normal queries, and makes `delete()` mark documents as deleted instead of removing them.

Managed fields are not accepted as normal create or update input. They are owned by Mongorm. Use `withDeleted()` to include deleted documents, `onlyDeleted()` to inspect the deleted set, `restore()` to recover a document, and `forceDelete()` for permanent removal.

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
  items: orm.array(orm.object({
    sku: orm.string(),
    quantity: orm.number().int().positive(),
  })),
});
```

Nested fields can be selected using dot paths when querying. The TypeScript result preserves the nested structure.

## Unknown Keys

Choose Zod object behavior deliberately. If a document must be controlled tightly, use a strict object schema. If MongoDB documents intentionally carry extension fields, model that extension explicitly rather than relying on accidental passthrough behavior.
