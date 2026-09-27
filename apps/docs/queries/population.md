---
order: 6
---

# Population

Population loads a declared relation after the base document is read. It is explicit and typed rather than automatically applied to every query.

```ts
const post = await db.post.find({ _id: postId }).populate([
  {
    ref: 'author',
    fields: ['name', 'email'],
  },
]);
```

The populated relation is either the related document or `null` when the local key is absent or no target matches.

## Nested Population

```ts
const posts = await db.post.find({}).populate([
  {
    ref: 'author',
    fields: ['name', 'team'],
    populate: [
      {
        ref: 'team',
        fields: ['name'],
      },
    ],
  },
]);
```

Nested relation keys are included in the related projection when required to resolve the next level. You do not need to expose those implementation keys in the final selection.

## Population and Hidden Fields

Related models omit hidden fields by default. Use a `+` prefix in `fields` to explicitly include a
hidden target field:

```ts
const posts = await db.post.find({}).populate([
  {
    ref: 'author',
    fields: ['name', '+password'],
  },
]);
```

`fields` is checked against the populated schema, including hidden fields which require the `+`
prefix. The returned relation exposes only the requested fields. Use `'$all'` to include every
normally visible target field; it can be combined with hidden fields:

```ts
const posts = await db.post.find({}).populate([{ ref: 'author', fields: ['$all', '+password'] }]);
```

As at the query level, `fields: ['name']` selects only `_id` and `name`, while
`fields: ['+password']` selects only `_id` and that hidden field. `fields: ['$all']` includes all
normally visible target fields. The selector values are inferred from the relation's target schema.
An explicit `fields: []` selects only `_id` (plus any local keys needed internally for nested population).

## Population Cost

Population is not a free join. Each relation can add database work and response size. Prefer a small `fields` list, use scopes for known response shapes, and avoid recursively loading an entire graph.

## Explicit Population and Scopes

Use `.populate()` for a one-off shape. Use `.with('scopeName')` for a named shape. They are mutually exclusive modes on a query.
