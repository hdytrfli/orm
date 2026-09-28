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
  post: { author: { ref: 'user' } },
  comment: { author: { ref: 'user' }, post: { ref: 'post' } },
});
```

Each relation key is the local ObjectId field name. Its required `ref` names the target schema; the target key is `_id`. Relations only define forward ObjectId links. Reverse and aggregate virtuals are declared separately on the owning schema and bound to one of these relation fields with `defineVirtuals`.

## Relation Requirements

The relation key must be an existing ObjectId field on the source schema. Top-level fields and nested paths are supported; nested paths use dot notation, and the editor suggests valid ObjectId paths. Unknown relation keys and non-ObjectId fields are rejected by TypeScript, with runtime validation retained as a safeguard. The `ref` value is likewise checked against registered schema names.

```ts
const post = orm.schema({
  author: orm.objectId(),
});

const schemas = orm
  .defineSchemas({ user, post })
  .defineRelations({ post: { author: { ref: 'user' } } })
  .defineVirtuals({ user: { posts: { ref: 'post', via: 'author' } } });
```

For an ObjectId nested inside an object, use its dot path as the relation name and populate `ref`:

```ts
const person = orm.schema({
  profile: orm.object({ department: orm.objectId() }),
});
const departmentSchema = orm.schema({ employees: orm.virtual('many') });

const schemas = orm
  .defineSchemas({ people: person, departments: departmentSchema })
  .defineRelations({ people: { 'profile.department': { ref: 'departments' } } })
  .defineVirtuals({ departments: { employees: { ref: 'people', via: 'profile.department' } } });

const people = await db.people.find().populate([{ ref: 'profile.department', fields: ['name'] }]);
```

The populated result retains the nested shape: `person.profile.department` is the department document rather than a flattened `"profile.department"` property.

## Schema-Declared Virtuals

Virtuals are non-persisted fields declared in `orm.schema()` with `orm.virtual(kind)`. Bind each declaration in `defineVirtuals`: `ref` selects the related collection and `via` selects its relation field back to the owning schema. The owning document's `_id` is matched against that field. This explicit edge lets multiple virtuals reuse one relation.

```ts
const user = orm.schema({
  posts: orm.virtual('many'),
  firstPost: orm.virtual('first'),
  maxScore: orm.virtual('max'),
  postCount: orm.virtual('count'),
});
const post = orm.schema({
  author: orm.objectId(),
  title: orm.string(),
  score: orm.number(),
});

const connected = schemas.defineRelations({ post: { author: { ref: 'user' } } }).defineVirtuals({
  user: {
    posts: { ref: 'post', via: 'author' },
    firstPost: { ref: 'post', via: 'author' },
    maxScore: { ref: 'post', via: 'author', field: 'score' },
    postCount: { ref: 'post', via: 'author' },
  },
});
```

Kinds are `many`, `first`, `count`, `sum`, `avg`, `min`, and `max`. `many` returns an array; `first` returns a document or `null`; aggregates return numbers (`avg`, `min`, and `max` may be `null` when there are no values). Numeric aggregates require `field`, which is type-checked against the referenced schema. `count` counts matching documents and needs no field. Document virtuals can select fields; aggregate virtuals cannot. Prefix hidden fields with `+`, or use `'$all'` to include all normally visible fields.

```ts
const usersWithPosts = await db.user.find().virtual([{ ref: 'posts', fields: ['title'] }]);
const userStats = await db.user.find().virtual([{ ref: 'maxScore' }, { ref: 'postCount' }]);
```

Virtual field declarations are metadata only: they are excluded from Zod persistence parsing and never stored in MongoDB. Every declared virtual must be bound exactly once in `defineVirtuals`; missing and unknown bindings are rejected at runtime as well as by the type checker.

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
