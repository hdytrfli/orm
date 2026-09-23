---
order: 4
---

# Population

Population loads a declared relation after the base document is read. It is explicit and typed rather than automatically applied to every query.

```ts
const post = await db.post.find({ _id: postId }).populate([
  {
    ref: 'author',
    select: ['name', 'email'],
  },
]);
```

The populated relation is either the related document or `null` when the local key is absent or no target matches.

## Nested Population

```ts
const posts = await db.post.find({}).populate([
  {
    ref: 'author',
    select: ['name', 'teamId'],
    populate: [
      {
        ref: 'team',
        select: ['name'],
      },
    ],
  },
]);
```

Nested relation keys are included in the related projection when required to resolve the next level. You do not need to expose those implementation keys in the final selection.

## Population and Hidden Fields

Related models also omit hidden fields by default. A relation's `select` list can request visible fields, but hidden fields should remain unavailable unless the related model's design explicitly supports showing them.

## Population Cost

Population is not a free join. Each relation can add database work and response size. Prefer a small `select` list, use scopes for known response shapes, and avoid recursively loading an entire graph.

## Explicit Population and Scopes

Use `.populate()` for a one-off shape. Use `.with('scopeName')` for a named shape. They are mutually exclusive modes on a query.
