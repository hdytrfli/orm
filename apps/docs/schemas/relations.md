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
  post: { author: { ref: 'user', inverse: 'posts' } },
  comment: { author: { ref: 'user' }, post: { ref: 'post', inverse: 'comments' } },
});
```

Each relation key is the local ObjectId field name. Its required `ref` names the target schema; the target key is `_id`. An optional `inverse` declares a reverse virtual name on that target schema. Omitting `inverse` leaves a forward-only relation. Every entry uses the explicit object form.

## Relation Requirements

The relation field must exist on the source schema and use an ObjectId type. Top-level fields and nested paths are supported; nested paths use dot notation and remain type-hinted. Unknown schema names, non-ObjectId fields, and unknown relation paths fail during registry construction.

```ts
const post = orm.schema({
  author: orm.objectId(),
});

const schemas = orm
  .defineSchemas({ user, post })
  .defineRelations({ post: { author: { ref: 'user' } } });
```

For an ObjectId nested inside an object, use its dot path as the relation name and populate `ref`:

```ts
const person = orm.schema({
  profile: orm.object({ department: orm.objectId() }),
});

const schemas = orm.defineSchemas({ people: person, departments: department }).defineRelations({
  people: { 'profile.department': { ref: 'departments', inverse: 'employees' } },
});

const people = await db.people.find().populate([{ ref: 'profile.department', fields: ['name'] }]);
```

The populated result retains the nested shape: `person.profile.department` is the department document rather than a flattened `"profile.department"` property.

## Reverse Relations (Virtuals)

`inverse` derives a reverse traversal from the same edge; there is no separate virtual declaration. A virtual always joins from the source document's `_id` to the foreign ObjectId path that declared the edge. Non-`_id` source joins are intentionally out of scope; use separate queries for those cases.

```ts
const people = await db.departments
  .find()
  .virtual([{ virtual: 'employees', type: 'many', fields: ['name'] }]);
```

`.populate()` follows outgoing relation edges, and `.virtual()` follows inverse edges. They are separate query operations and cannot be chained on the same query. Cardinality and projection belong to the use site: `many` returns an array and `first` returns a document or `null`. The `fields` option is checked against the target schema; prefix hidden fields with `+`, or use `'$all'` to include all normally visible fields.

```ts
const peopleWithPosts = await db.user
  .find()
  .virtual([{ virtual: 'posts', type: 'many', fields: ['title'] }]);

// The same graph edge can have a different result shape in another query.
const personWithFirstPost = await db.user
  .find()
  .virtual([{ virtual: 'posts', type: 'first', fields: ['title'] }]);

const postCounts = await db.user
  .find()
  .virtual([{ virtual: 'posts', type: 'many', aggregate: { field: 'score', type: 'count' } }]);
```

An aggregate virtual returns a number instead of related documents. `aggregate.field` is required and type-checked as a numeric target field. `count` counts related documents with a non-null value for that field; `sum`, `average`, `min`, and `max` calculate that field's statistic. Aggregates are only valid with `type: 'many'` and cannot be combined with `fields`. Virtual populations do not support nested `populate`.

## Relations Are Opt-In

This query does not load the author:

```ts
const posts = await db.post.find({});
```

This query does:

```ts
const posts = await db.post.find({}).populate([{ ref: 'author', fields: ['name'] }]);
```

Keeping population explicit makes query cost and response shape visible at the call site.

## Registry Design Advice

- Keep one application-level registry for related models.
- Use small registries in isolated packages only when those packages truly own separate data boundaries.
- Define relations in one place rather than scattering ad hoc joins through services.
- Treat a relation definition as a loading capability, not a promise that every query must use it.
