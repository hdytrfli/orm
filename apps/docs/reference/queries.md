---
order: 3
---

# Query API

The list and single-document builders share selection and population methods. List queries additionally support sorting, offset pagination, cursor pagination, limits, and counts.

## List Query Methods

| Method            | Result            | Notes                                                      |
| ----------------- | ----------------- | ---------------------------------------------------------- |
| `sort(spec)`      | list query        | Directions are `asc` or `desc`.                            |
| `skip(count)`     | list query        | Non-negative integer; incompatible with cursor pagination. |
| `limit(count)`    | list query        | Non-negative integer.                                      |
| `select(fields)`  | narrowed query    | Retains `_id`; accepts nested paths.                       |
| `show(fields)`    | expanded query    | Explicitly includes hidden fields.                         |
| `populate(specs)` | populated query   | Loads declared relations.                                  |
| `with(name)`      | scoped query      | Applies a named population scope.                          |
| `withDeleted()`   | query             | Includes active and soft-deleted documents.                |
| `onlyDeleted()`   | query             | Restricts results to soft-deleted documents.               |
| `count()`         | promise of number | Exact filtered count.                                      |
| `count(true)`     | promise of number | Estimated unfiltered count.                                |
| `cursor(after?)`  | async cursor      | Requires positive limit and default `_id` sort.            |

## Single Query Methods

`find()` supports `select()`, `show()`, `populate()`, and `with()`. It resolves to `Result | null`.

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

An async iterable that yields one page. Its `next` property is an `ObjectId` when another page is available and `null` at the end.
