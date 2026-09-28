---
order: 8
---

# Aggregate Virtuals

Aggregate virtuals attach one numeric value to each owner document by reducing documents from a related collection. They are declared as schema virtuals and bound to a relation edge, just like `many` and `first` virtuals, but they return numbers rather than related documents.

Use them for per-owner values such as a project count, total invoice amount, or maximum score. They are not a replacement for [MongoDB aggregation pipelines](/queries/aggregation): use `Model.aggregate()` to group across owners, reshape results, perform arbitrary stages, or compute a report that is not a property of each returned owner.

## Define the schema and binding

The available aggregate kinds are `count`, `distinct`, `sum`, `avg`, `min`, `max`, and `median`:

```ts
const userSchema = orm.schema({
  postCount: orm.virtual('count'),
  distinctScores: orm.virtual('distinct'),
  totalScore: orm.virtual('sum'),
  averageScore: orm.virtual('avg'),
  lowestScore: orm.virtual('min'),
  highestScore: orm.virtual('max'),
  medianScore: orm.virtual('median'),
});

const postSchema = orm.schema({
  author: orm.objectId(),
  title: orm.string(),
  score: orm.number().optional(),
});

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
      postCount: {
        ref: 'posts',
        via: 'author',
        field: 'title',
      },
      distinctScores: {
        ref: 'posts',
        via: 'author',
        field: 'score',
      },
      totalScore: {
        ref: 'posts',
        via: 'author',
        field: 'score',
      },
      averageScore: {
        ref: 'posts',
        via: 'author',
        field: 'score',
      },
      lowestScore: {
        ref: 'posts',
        via: 'author',
        field: 'score',
      },
      highestScore: {
        ref: 'posts',
        via: 'author',
        field: 'score',
      },
      medianScore: {
        ref: 'posts',
        via: 'author',
        field: 'score',
      },
    },
  });
```

`ref` chooses the related collection and `via` chooses the relation path on that collection which targets the virtual's owner. `field` behavior depends on the kind:

- For `sum`, `avg`, `min`, `max`, and `median`, `field` is required and must be numeric. Nested numeric field paths are supported.
- For `count` and `distinct`, `field` is required and must be a scalar schema field: strings, numbers, booleans, dates, ObjectIds, and scalar enums/literals are supported. Scalar leaves in nested objects are valid. Objects and arrays themselves are rejected to avoid expensive whole-value comparison.
- `count` counts related documents where the field exists and is not `null`.
- `distinct` counts the number of different present, non-null values for the field. It does not return a list of distinct values.

An empty string, `0`, and `false` are present scalar values and are counted. Missing and `null` fields are excluded by both `count` and `distinct`.

## Result and empty-set behavior

| Kind       | Result type      | When no related documents match |
| ---------- | ---------------- | ------------------------------- |
| `count`    | `number`         | `0`                             |
| `distinct` | `number`         | `0`                             |
| `sum`      | `number`         | `0`                             |
| `avg`      | `number \| null` | `null`                          |
| `min`      | `number \| null` | `null`                          |
| `max`      | `number \| null` | `null`                          |
| `median`   | `number \| null` | `null`                          |

The TypeScript result includes the property only when the virtual is requested by `.virtual()` or a scope. Numeric aggregate values are not projected documents and do not accept a `fields` selector.

## Query aggregate virtuals

Request one or several declared aggregate virtuals by name:

```ts
const users = await db.users.find({}).virtual([
  {
    ref: 'postCount',
  },
  {
    ref: 'averageScore',
  },
  {
    ref: 'highestScore',
  },
]);

const count: number = users[0].postCount;
const average: number | null = users[0].averageScore;
const maximum: number | null = users[0].highestScore;
```

`median` uses MongoDB's approximate `$median` accumulator (available in MongoDB 7.0 and later). It may not equal the exact statistical median, especially for small input sets; use it where an estimate is acceptable, and do not write tests or business rules that depend on an exact midpoint.

Aggregate virtual query specs accept only `ref`. The query cannot override the kind or field. Use a scope if you need to load aggregate and document virtuals together with forward relations; population modes cannot be chained on one query. See [Population Scopes](/schemas/scopes).

## Invalid configurations

These are configuration errors:

- Omitting `field` for any aggregate kind.
- For numeric aggregate kinds, pointing `field` at a string, date, ObjectId, array, or unknown field.
- Pointing `count` or `distinct` at an object, array, or unknown path.
- Supplying `field` to document virtual kinds (`many` and `first`).
- Binding `via` to a relation that points somewhere other than the owner schema.
- Supplying `fields` when requesting an aggregate virtual.

`count` and `distinct` both ignore missing and `null` values, but answer different questions: `count` counts documents with a usable value; `distinct` counts the different usable values. For example, values `['active', 'active', 'complete', null, missing]` produce a count of `3` and a distinct count of `2`. They require the same scalar field types; use `count` when duplicates should count separately and `distinct` when they should collapse to one value.

The binding is checked by TypeScript where possible and validated at runtime as part of registry construction. Runtime validation matters when schemas or definitions cross untyped JavaScript boundaries.

## When to use a pipeline instead

Aggregate virtuals are useful when every owner query may optionally include a simple value computed from one related collection. Prefer `Model.aggregate()` when you need to:

- Group multiple owners into result buckets.
- Apply multi-stage transformations or joins.
- Filter or sort on a computed aggregate before selecting owners.
- Return a report/document shape that is not a virtual property on the owner.

Pipeline output is not parsed by the schema, and its TypeScript result type is supplied by the caller. See [Aggregation](/queries/aggregation) for pipeline options, soft-delete behavior, and result typing.

## Performance: use virtuals sparingly

Virtuals are explicit, but they are not free. The current executor performs related-collection work for each returned owner and each requested virtual. A page of many owners with several virtuals can therefore issue many database operations and add noticeable latency. In practice:

- Request aggregate virtuals only on endpoints that need them.
- Filter and paginate the owner query before loading virtuals.
- Avoid loading many virtuals over large result sets or in deeply nested response flows.
- Prefer a single `Model.aggregate()` pipeline when you need to calculate values for many owners efficiently, filter/sort owners by derived metrics, or return a report.
- Measure query latency and database load with realistic data volumes.

Use virtuals for convenient per-document read shapes, not as a substitute for a deliberately designed reporting query or a cached/materialized value when the value is needed at high volume.
