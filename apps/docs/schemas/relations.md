---
order: 6
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

The relation field must exist on the source schema and use an ObjectId type. Top-level fields and nested paths are supported; nested paths use dot notation and remain type-hinted. Unknown schema names, non-ObjectId fields, and unknown relation paths fail during registry construction.

```ts
const post = orm.schema({
  author: orm.objectId(),
});

const schemas = orm.defineSchemas({ user, post }).defineRelations({ post: { author: 'user' } });
```

For an ObjectId nested inside an object, use its dot path as the relation name and populate `ref`:

```ts
const person = orm.schema({
  profile: orm.object({ department: orm.objectId() }),
});

const schemas = orm
  .defineSchemas({ people: person, departments: department })
  .defineRelations({ people: { 'profile.department': 'departments' } });

const people = await db.people.find().populate([{ ref: 'profile.department', select: ['name'] }]);
```

The populated result retains the nested shape: `person.profile.department` is the department document rather than a flattened `"profile.department"` property.

## Virtuals Can Join Nested ObjectIds

Virtuals use the same typed dot-path notation for their local and foreign ObjectId fields. The virtual's own name remains the key used by `populate`:

```ts
const schemas = connected.defineVirtual({
  people: {
    departmentProjects: {
      ref: 'projects',
      local: 'profile.department',
      foreign: 'department',
      type: 'many',
      select: ['title'],
    },
  },
});

const people = await db.people.find().populate([{ virtual: 'departmentProjects' }]);
```

Virtual cardinality and projection are part of the definition, so each virtual has one stable result shape and query-time `populate` only names it. `type: 'many'` returns an array; `type: 'first'` returns one document or `null`. `select` and `show` are type-checked against the target schema and are only available for document-returning virtuals. Hidden target fields remain excluded unless listed in `show`.

`match` is also definition-level and only available for `type: 'many'`. It is checked against the target schema and is combined with the virtual join condition, so it cannot override the join.

```ts
const registry = schemas.defineVirtual({
  people: {
    activeProjects: {
      ref: 'projects',
      local: '_id',
      foreign: 'owner',
      type: 'many',
      match: { status: 'active' },
      select: ['title', 'status'],
    },
    featuredProject: {
      ref: 'projects',
      local: '_id',
      foreign: 'owner',
      type: 'first',
      select: ['title'],
    },
    projectCount: {
      ref: 'projects',
      local: '_id',
      foreign: 'owner',
      type: 'many',
      aggregate: { field: 'score', type: 'count' },
    },
  },
});

const peopleWithProjects = await db.people
  .find()
  .populate([
    { virtual: 'activeProjects' },
    { virtual: 'featuredProject' },
    { virtual: 'projectCount' },
  ]);
```

An aggregate virtual returns a number instead of related documents. `aggregate.field` is required and type-checked as a numeric target field for every operation. `count` counts related documents with a non-null value for that field; `sum`, `average`, `min`, and `max` calculate that field's statistic. Aggregates are only valid with `type: 'many'` and may be combined with `match`, but not `select` or `show`. Virtual populations intentionally do not support nested `populate`; declare/populate a regular relation separately when needed.

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
