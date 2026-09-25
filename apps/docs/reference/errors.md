---
order: 4
---

# Errors

Mongorm exposes purpose-specific errors for invalid runtime states.

Each ORM error exposes a stable `code` value for machine-readable handling.

## `DatabaseNotConnectedError` (`DATABASE_NOT_CONNECTED`)

Thrown when a model attempts to access the native database before `connect()` has completed.

## `InvalidQueryError` (`INVALID_QUERY`)

Thrown when incompatible query modes are combined, such as explicit population and a named scope.
On a soft-delete model, aggregation also throws this error for a first stage that does not produce model documents, unless `{ includeDeleted: true }` explicitly opts out of automatic filtering.

## `CursorQueryError` (`CURSOR_QUERY_INVALID`)

Thrown when cursor pagination is requested without a positive limit, with `skip()`, or with an unsupported sort.

## `EstimatedCountError` (`ESTIMATED_COUNT_FILTER_UNSUPPORTED`)

Thrown when `count(true)` is used with a query filter or the default soft-delete filter. Estimated counts are collection-wide and cannot represent a filtered total; use `.deleted('include')` when requesting an estimate on a soft-delete schema.

## Validation Errors

Zod validation errors are raised when schema parsing rejects an input. They contain field-level issue information suitable for conversion into an API validation response.

## Error Boundaries

Mongorm throws its exported ORM errors for its own invalid states, Zod errors for rejected schema input, and MongoDB driver errors for server or index failures. Catch and translate these at the boundary of your application; Mongorm does not define HTTP response helpers or transport-specific error formats.
