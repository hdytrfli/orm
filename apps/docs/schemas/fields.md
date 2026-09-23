---
order: 2
---

# Field Types and Composition

`orm` exposes the native lowercase Zod constructors available in the installed Zod version. This keeps the learning curve small: Zod documentation remains useful, and Mongorm adds only its database-specific helpers.

## Primitive Fields

```ts
const schema = orm.schema({
  text: orm.string(),
  count: orm.number().int().nonnegative(),
  enabled: orm.boolean(),
  createdAt: orm.date(),
  metadata: orm.record(orm.string()),
});
```

## Enumerations and Literals

```ts
const state = orm.enum(['draft', 'published', 'archived']);
const visibility = orm.union([orm.literal('public'), orm.literal('private')]);
```

Use an enum for a closed set of named values. Use a union when variants have different shapes.

## Discriminated Unions

```ts
const event = orm.discriminatedUnion('kind', [
  orm.object({ kind: orm.literal('login'), userId: orm.objectId() }),
  orm.object({ kind: orm.literal('purchase'), orderId: orm.objectId() }),
]);
```

Discriminators make both runtime validation and TypeScript narrowing predictable.

## MongoDB ObjectIds

```ts
const comment = orm.schema({
  body: orm.string(),
  authorId: orm.objectId(),
});
```

`objectId()` validates MongoDB `ObjectId` instances. It is not the same as a string containing a hexadecimal ObjectId. Convert request strings at the transport boundary before passing them to Mongorm.

## Refinements and Transforms

Native Zod refinements can express local invariants:

```ts
const password = orm.string().min(12);
```

Keep database-stable values free of request-specific transforms unless the transformed representation is truly what should be stored.
