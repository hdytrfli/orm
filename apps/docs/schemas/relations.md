---
order: 4
---

# Registries and Relations

Relations are declared after schemas exist. This two-step design supports circular graphs and keeps each schema's document shape independent from how the application chooses to load related documents.

## Create a Registry

```ts
const schemas = orm.defineSchemas({
  user,
  post,
  comment,
});
```

The registry preserves the literal names and returns typed builder methods.

## Define Relations

```ts
const connected = schemas.defineRelations({
  post: { author: 'user' },
  comment: { author: 'user', post: 'post' },
});
```

Each relation's public `ref` name is the local foreign-key field name itself. The value is the target schema's registry key, and the built-in target key is `_id`. A field named `authorId` therefore creates a relation named `authorId`, not `author`.

## Relation Requirements

The relation field must exist on the source schema and use an ObjectId-compatible type. Unknown schema names and unknown relation fields fail during registry construction.

```ts
const post = orm.schema({
  author: orm.objectId(),
});

const schemas = orm.defineSchemas({ user, post }).defineRelations({ post: { author: 'user' } });
```

## Relations Are Opt-In

This query does not load the author:

```ts
const posts = await db.post.find({});
```

This query does:

```ts
const posts = await db.post.find({}).populate([{ ref: 'author', select: ['name'] }]);
```

Keeping population explicit makes query cost and response shape visible at the call site.

## Registry Design Advice

- Keep one application-level registry for related models.
- Use small registries in isolated packages only when those packages truly own separate data boundaries.
- Define relations in one place rather than scattering ad hoc joins through services.
- Treat a relation definition as a loading capability, not a promise that every query must use it.
