---
order: 1
---

# ORM and Schema API

## `orm.schema(shape)`

Creates a schema from a record of Zod fields.

```ts
const user = orm.schema({ name: orm.string() });
```

The returned schema supports parsing and carries the field metadata used by models and query types.

## Native Zod Constructors

`orm` exposes lowercase callable Zod constructors, including `string`, `number`, `boolean`, `object`, `array`, `record`, `union`, `literal`, `enum`, and the constructors available in the installed Zod version.

```ts
orm.string().min(1);
orm.array(orm.string());
orm.object({ enabled: orm.boolean() });
```

## `orm.objectId()`

Creates a Zod field for MongoDB `ObjectId` values.

## `.hidden()`

Marks a field as excluded from default model projections. Hidden fields can be requested explicitly with `.show()`.

## `schema.options(options)`

Enables managed persistence behavior once per schema:

```ts
const user = orm.schema({ name: orm.string() }).options({
  timestamps: true,
  softdelete: true,
});
```

- `timestamps` manages `createdAt` and `updatedAt`.
- `softdelete` manages nullable `deletedAt` and filters deleted documents from normal reads.

## `orm.defineSchemas(registry)`

Creates a typed registry from named schemas.

```ts
const schemas = orm.defineSchemas({ user, post });
```

## `.defineRelations(definitions)`

Adds relation metadata to a registry. Each source field maps to a target registry key:

```ts
schemas.defineRelations({ post: { authorId: 'user' } });
```

## `.defineScopes(definitions)`

Adds named population specifications to registry schemas:

```ts
schemas.defineScopes({
  post: { detail: [{ ref: 'author', select: ['name'] }] },
});
```

## `orm.ref(resolve)`

Creates a lazily resolved string reference for schema-level relation definitions where a direct target would create an import cycle. Registry-based relations are usually easier to maintain for application graphs.
