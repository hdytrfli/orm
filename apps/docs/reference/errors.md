---
order: 4
---
# Errors

Mongorm exposes purpose-specific errors for invalid runtime states.

## `DatabaseNotConnectedError`

Thrown when a model attempts to access the native database before `connect()` has completed.

## `InvalidQueryError`

Thrown when incompatible query modes are combined, such as explicit population and a named scope.

## `CursorQueryError`

Thrown when cursor pagination is requested without a positive limit, with `skip()`, or with an unsupported sort.

## `EstimatedCountError`

Thrown when `count(true)` is used with a non-empty filter. Estimated counts are collection-wide and cannot represent a filtered total.

## Validation Errors

Zod validation errors are raised when schema parsing rejects an input. They contain field-level issue information suitable for conversion into an API validation response.

## Handling Errors

Translate expected errors at the application boundary and preserve unexpected errors for logging and monitoring:

```ts
try {
  return await db.user.create(input);
} catch (error) {
  if (error instanceof ZodError) {
    return badRequest(error.issues);
  }
  throw error;
}
```
