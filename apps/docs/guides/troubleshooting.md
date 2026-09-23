---
order: 5
---
# Troubleshooting

## `DatabaseNotConnectedError`

Call `await db.connect()` before executing a model query. Constructing the database handle does not establish a connection.

## Selection Type Errors

Check the path against the schema. Nested selection uses dot notation such as `profile.avatarUrl`, while the parent must actually be an object in the inferred schema.

## Population Type Errors

The relation must be defined in `defineRelations()`, and nested `ref` values must exist on the target schema's relation map. Check the direction of the local foreign key.

## Cursor Errors

Set a positive limit, remove `skip()`, and use the default `_id` ascending ordering. Cursor pagination intentionally rejects arbitrary sorting.

## Estimated Count Errors

`count(true)` is collection-wide. Use `count()` for a filtered query.

## A Field Is Missing

Check whether it is hidden, whether `.select()` omitted it, or whether a population specification selected a narrower related document. Also verify that the stored document actually contains the field.

## Existing Data Fails Assumptions

Schemas validate mutations, but old database records may predate the current schema. Run a migration or handle legacy records explicitly before tightening constraints.
