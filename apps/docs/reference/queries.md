---
order: 4
---

# Query API

`find()` builds a list query. It supports selection, population, sorting, pagination, limits, counts, and terminal `.first()` for a single document.

Use [`Model.aggregate<Result>()`](/queries/aggregation) when MongoDB pipeline stages transform the result shape. The result type is explicit; awaiting the query returns `Result[]`, and the query is also async iterable.

## List Query Methods

| Method               | Result            | Notes                                                                                          |
| -------------------- | ----------------- | ---------------------------------------------------------------------------------------------- |
| `sort(spec)`         | list query        | Directions are `asc` or `desc`.                                                                |
| `skip(count)`        | list query        | Non-negative integer; incompatible with cursor pagination.                                     |
| `limit(count)`       | list query        | Non-negative integer.                                                                          |
| `select(fields)`     | narrowed query    | Retains `_id`; accepts nested paths.                                                           |
| `show(fields)`       | expanded query    | Explicitly includes hidden fields.                                                             |
| `populate(specs)`    | populated query   | Loads declared relations.                                                                      |
| `with(name)`         | scoped query      | Applies a named population scope.                                                              |
| `deleted('only')`    | query             | Restricts results to soft-deleted documents.                                                   |
| `deleted('include')` | query             | Includes active and soft-deleted documents.                                                    |
| `count()`            | promise of number | Exact filtered count.                                                                          |
| `count(true)`        | promise of number | Estimated unfiltered count.                                                                    |
| `cursor(after?)`     | async cursor      | No limit streams all matches; a positive limit enables bounded pages. Uses default `_id` sort. |

## `first()`

`first()` is terminal and resolves to `Result | null`. It cannot be followed by list methods such as `sort()`, `skip()`, `limit()`, or `cursor()`.

## `select(fields)`

Selects visible top-level or nested document paths. `_id` is retained automatically.

## `show(fields)`

Adds hidden fields to the projection. The field names must be declared as hidden in the schema.

## `populate(specs)`

Each specification has a relation reference and optional `select` and nested `populate` values:

```ts
[{ ref: 'author', select: ['name'], populate: [] }];
```

## `with(name)`

Applies a named scope. Explicit population and scopes cannot be combined on one query.

## `ModelCursor`

An async iterable. Without a limit it streams all matching documents in batches; with a positive limit it yields one page. In page mode, `next` is an `ObjectId` when another page is available and `null` at the end. In stream mode, `next` remains `null`.

## `Model.aggregate<Result>(pipeline, options?)`

Runs an aggregation pipeline on the model's collection. Awaiting the result returns `Result[]`; it can also be consumed with `for await...of`. `Result` must describe the pipeline output; Mongorm does not infer or validate it. `options.filter` is schema-checked against the model and applied to source documents. On soft-delete schemas, active documents are filtered by default. `{ includeDeleted: true }` explicitly opts out of the implicit soft-delete condition and is only accepted for those schemas. See [Aggregation](/queries/aggregation) for stage-order constraints, limitations, and examples.
