---
order: 5
---

# Population Scopes

A scope is a named population specification. It packages a relationship-loading policy without hiding the fact that related data is being fetched.

```ts
const schemas = orm
  .defineSchemas({ user, post })
  .defineRelations({ post: { authorId: 'user' } })
  .defineScopes({
    post: {
      list: [{ ref: 'author', select: ['name'] }],
      detail: [{ ref: 'author', select: ['name', 'email'] }],
    },
  });
```

Apply a scope with `.with()`:

```ts
const posts = await db.post.find({ published: true }).with('list');
```

## Scopes Are Typed

Only scopes defined for the current model can be passed to `.with()`. The populated property is added to the result type, and its selected fields are preserved.

## Explicit Population Versus Scopes

Use explicit population for one-off queries:

```ts
await db.post.find({}).populate([{ ref: 'author', select: ['name'] }]);
```

Use a scope when a shape is reused by many endpoints:

```ts
await db.post.find({}).with('list');
```

Do not combine `.populate()` and `.with()` in the same query. Choose one population mode so the result contract remains unambiguous.

## Nested Scopes

Population specifications can recurse through relation graphs. Define the nested shape at the point where it is reused, and select only the fields required by the consumer.
