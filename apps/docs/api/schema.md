# Schema API

## `orm.schema(shape)`

Wraps a Zod raw shape in a Mongorm `Schema`.

```ts
const userSchema = orm.schema({
  name: orm.string(),
  email: orm.email(),
});
```

The schema provides `parse()`, `safeParse()`, `parsePartial()`, fields, hidden-field metadata, and registry metadata.

## Zod Constructors

`orm` exposes lowercase callable Zod constructors. This includes string, number, boolean, date, email, URL, object, array, union, tuple, record, and other native Zod constructors.

Non-constructor exports such as `INVALID`, `NEVER`, `ZodAny`, and internal namespaces are intentionally not exposed in `orm` autocomplete.

## `orm.objectId()`

Creates a MongoDB ObjectId validator. It is also the required local field type for registry relations.

## `.hidden()`

Marks a Zod schema field as hidden from default query results:

```ts
password: orm.string().hidden()
```

## `orm.defineSchemas()`

Creates a typed schema registry. Chain `defineRelations()` and `defineScopes()` on the result.
