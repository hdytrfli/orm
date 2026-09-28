---
order: 9
---

# Population Scopes

A scope is a named population specification attached to a schema in the registry. It packages a relation/virtual-loading policy without hiding the fact that related data is being fetched. Define relations first, bind every declared virtual next, and add scopes last so each scope can refer to the complete graph.

```ts
const schemas = orm
  .defineSchemas({
    user,
    post,
  })
  .defineRelations({
    post: {
      author: {
        ref: 'user',
      },
    },
  })
  .defineVirtuals({
    user: {
      posts: {
        ref: 'post',
        via: 'author',
      },
    },
  })
  .defineScopes({
    post: {
      list: [
        {
          ref: 'author',
          fields: ['name'],
        },
      ],
      detail: [
        {
          ref: 'author',
          fields: ['name', 'email'],
        },
      ],
    },
    user: {
      overview: [
        {
          ref: 'posts',
          fields: ['title'],
        },
      ],
    },
  });
```

`defineScopes()` takes a map from registered schema name to scope name to a readonly population-spec array. Scope names are arbitrary string names unique within that schema; the same name may be used on another schema. An empty array is valid and describes a scope that adds no population. Each spec uses the same `ref`, `fields`, and (for forward relations) nested `populate` properties as explicit population. Relation refs must name a relation on that model; virtual refs must name a virtual declared and bound on it. `fields` is checked against the referenced schema, with hidden fields selected using `+` and `'$all'` including normally visible fields. Aggregate virtual refs accept only `ref`, not `fields`. See [Registries and Relations](/schemas/relations), [Virtual Fields](/schemas/virtuals), and [Aggregate Virtuals](/schemas/virtual-aggregates) for declaration and binding details.

Scopes are accessed from the model query builder with `.with(name)`. The scope name is checked against the current model, and the result type includes the fields loaded by its specs:

```ts
const posts = await db.post
  .find({
    published: true,
  })
  .with('list');
```

## Scopes Are Typed

Only scopes defined for the current model can be passed to `.with()`. A scope can contain multiple specs and can load a mix of forward relations and virtuals. Its populated properties and selected fields are reflected in the result type. A scope is not a database or authorization boundary; it is a reusable query shape.

Use `ModelScopeName<Model>` when an abstraction needs a named union of a model's scopes. `model.features.scopes` provides the runtime list of scope names; it is frozen metadata, not an authorization check.

Scope definitions are static population instructions. They do not add filters, sorting, or conditional logic to `.find()`. Pass those options to the query itself:

```ts
const posts = await db.post
  .find({
    published: true,
  })
  .sort({
    createdAt: 'desc',
  })
  .with('list');
```

An unknown scope name and a scope name defined on a different model are type errors:

```ts
db.post.find().with('list');

// @ts-expect-error `overview` is defined for user, not post.
db.post.find().with('overview');
```

## Explicit Population Versus Scopes

Use explicit population for one-off queries:

```ts
await db.post.find({}).populate([
  {
    ref: 'author',
    fields: ['name'],
  },
]);
```

Use a scope when a shape is reused by many endpoints:

```ts
await db.post.find({}).with('list');
```

Do not combine `.populate()`, `.virtual()`, and `.with()` in the same query. Choose one population mode so the result contract remains unambiguous. When loading a mixed group of relation and virtual specs at the query call site, use a scope.

For example, define a scope containing both kinds of population rather than chaining two loading modes:

```ts
const schemas = orm
  .defineSchemas({
    user,
    post,
  })
  .defineRelations({
    post: {
      author: {
        ref: 'user',
      },
    },
  })
  .defineVirtuals({
    user: {
      posts: {
        ref: 'post',
        via: 'author',
      },
    },
  })
  .defineScopes({
    user: {
      dashboard: [
        {
          ref: 'posts',
          fields: ['title'],
        },
      ],
    },
    post: {
      detail: [
        {
          ref: 'author',
          fields: ['name'],
        },
      ],
    },
  });

const userDashboard = await db.user.find().with('dashboard');
```

## Nested Scopes

Forward-relation specs may recursively populate further forward relations using `populate`. Virtual specs do not support nested population. A scope can package nested forward-relation specs:

```ts
const schemas = orm
  .defineSchemas({
    user,
    team,
    post,
  })
  .defineRelations({
    post: {
      author: {
        ref: 'user',
      },
    },
    user: {
      team: {
        ref: 'team',
      },
    },
  })
  .defineScopes({
    post: {
      detail: [
        {
          ref: 'author',
          fields: ['name'],
          populate: [
            {
              ref: 'team',
              fields: ['name'],
            },
          ],
        },
      ],
    },
  });
```

Keep scope result shapes focused: select only the fields the consumers need and avoid loading an entire graph by default.
