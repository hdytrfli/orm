---
order: 7
---

# Virtual Fields

A virtual field is a schema-declared result property that is populated from another collection but is not stored on the owning document. Use virtuals for reverse relations and for computed values attached to each owner document.

Use a virtual when the related documents contain an ObjectId pointing back to the owner. Use a forward [relation](/schemas/relations) when the current document stores an ObjectId to one target. Use a [population scope](/schemas/scopes) when a reusable query shape should load a mix of relations and virtuals. For per-owner numeric summaries and counts, see [Aggregate Virtuals](/schemas/virtual-aggregates).

## Declare a virtual on the schema

Declare the field and its result kind in `orm.schema()` with `orm.virtual(kind)`:

```ts
const userSchema = orm.schema({
  name: orm.string(),
  posts: orm.virtual('many'),
  mostRecentPost: orm.virtual('first'),
});

const postSchema = orm.schema({
  author: orm.objectId(),
  title: orm.string(),
});
```

Virtual declarations are separate from persisted fields. They do not become Zod fields, are not accepted by `create()` or `update()`, and are not saved to MongoDB. They also do not load automatically; explicitly request one in a query or scope.

## Bind the declaration to a relation

After registering schemas and declaring the forward relation, bind each declared virtual with `defineVirtuals()`:

```ts
const schemas = orm
  .defineSchemas({
    users: userSchema,
    posts: postSchema,
  })
  .defineRelations({
    posts: {
      author: {
        ref: 'users',
      },
    },
  })
  .defineVirtuals({
    users: {
      posts: {
        ref: 'posts',
        via: 'author',
      },
      mostRecentPost: {
        ref: 'posts',
        via: 'author',
      },
    },
  });
```

For every user, Mongorm finds posts whose `author` ObjectId equals that user's `_id`. The binding describes the edge; the virtual declaration fixes the result kind.

### Binding properties

| Property | Required             | Meaning                                                                                                                                                                                                         |
| -------- | -------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ref`    | yes                  | Registered related schema/collection.                                                                                                                                                                           |
| `via`    | yes                  | Relation field on the `ref` schema that points back to this virtual's owner. Top-level and nested relation paths are supported.                                                                                 |
| `field`  | aggregate kinds only | Required for every aggregate. Numeric for `sum`, `avg`, `min`, `max`, and `median`; scalar for `count` and `distinct`. Objects and arrays are not valid. See [Aggregate Virtuals](/schemas/virtual-aggregates). |

The `via` relation must target the schema declaring the virtual. A binding cannot point at an unrelated edge. Multiple virtuals may use the same `ref` and `via` with different declared kinds. `field` is invalid for `many` and `first`.

Every schema-declared virtual must be bound exactly once. TypeScript checks supplied names and binding values, and runtime validation catches missing bindings and invalid registry state. A schema without virtual declarations needs no entry in `defineVirtuals()`.

## Load virtual documents

Call `.virtual()` on a model query. A virtual population spec accepts `ref` (the declared virtual's name) and optional `fields` (the related-document projection):

```ts
const users = await db.users.find({}).virtual([
  {
    ref: 'posts',
    fields: ['title'],
  },
]);
```

The returned `posts` property is an array because the schema declared `orm.virtual('many')`. `mostRecentPost` is a document or `null` because its declaration is `first`:

```ts
const users = await db.users.find({}).virtual([
  {
    ref: 'mostRecentPost',
    fields: ['title'],
  },
]);

const postTitle: string | undefined = users[0]?.mostRecentPost?.title;
```

`many` returns `[]` if no related documents exist. `first` returns `null`. A `first` virtual uses MongoDB's first matching result and does not declare a sort order; do not use it when the business contract requires a specific newest or oldest record. Related-document order for `many` is also not a stable ordering contract.

### Query-time virtual spec

| Property | Required                | Meaning                                                                                                       |
| -------- | ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| `ref`    | yes                     | Virtual field declared on the current model.                                                                  |
| `fields` | no; document kinds only | Selected fields from related documents. Hidden fields require `+`; `'$all'` includes normally visible fields. |

The query spec cannot override `kind`, `via`, or aggregate `field`, and it cannot specify nested `populate`. Those are schema-level decisions. Aggregate virtuals accept only `ref`; see [Aggregate Virtuals](/schemas/virtual-aggregates).

## Query modes and scopes

`.virtual()` loads virtual fields; `.populate()` loads forward relations. These are mutually exclusive query modes, as is `.with()` for a named scope. Use `.with()` when one query must load both relation and virtual specs or when a shape is reused by multiple call sites. See [Population Scopes](/schemas/scopes).

## Common mistakes

- Declaring a virtual but forgetting its binding. The registry rejects the incomplete configuration.
- Putting the virtual on the related schema instead of the document whose result should contain the virtual property.
- Setting `via` to an ObjectId field that targets a different schema.
- Declaring the same relation path as a virtual kind at query time. Query specs cannot change cardinality.
- Treating a virtual as a stored field in create/update input or assuming it is loaded by every query.
- Using a `first` virtual when a deterministic sort order is required.

Virtuals are a read-shaping feature, not a persistence shortcut or authorization rule. They add database work, so request only the virtuals and fields needed by the caller.

### Use virtuals sparingly

Loading a virtual adds related-collection work for the returned owner documents. Keep the owner result set paginated, request only the fields needed, and do not attach every available virtual to every query by default. For high-volume reporting, compare with a pipeline or a materialized/cached value. See [Aggregate Virtual performance guidance](/schemas/virtual-aggregates#performance-use-virtuals-sparingly).
