---
order: 2
---

# ORM and Schema API

## `orm.schema(shape)`

Creates a schema from a record of Zod fields.

```ts
const user = orm.schema({ name: orm.string() });
```

The returned schema supports parsing and carries the field metadata used by models and query types.

The underlying Zod object is available as `schema.definition` for advanced Zod composition. A derived Zod schema does not change the schema registered with a model; see [Escape Hatches](/guides/escape-hatches) for details.

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
  hideManaged: true,
});
```

- `timestamps` manages `createdAt` and `updatedAt`.
- `softdelete` manages nullable `deletedAt` and filters deleted documents from normal reads.
- `hideManaged` hides whichever managed fields are enabled from default query results. Use `.show()` to include them explicitly. It affects query projections; mutation methods such as `create()` and `update()` still return the full document.

## `orm.defineSchemas(registry)`

Creates a typed registry from named schemas.

```ts
const schemas = orm.defineSchemas({ user, post });
```

## `.defineRelations(definitions)`

Adds relation metadata to a registry. Each source field maps to a target registry key:

```ts
schemas.defineRelations({ post: { author: 'user' } });
```

## `.defineScopes(definitions)`

Adds named population specifications to registry schemas:

```ts
schemas.defineScopes({
  post: { detail: [{ ref: 'author', select: ['name'] }] },
});
```
