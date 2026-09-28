---
order: 2
---

# Schemas

Schemas are the source of truth for document validation, field inference, hidden-field behavior, relation keys, and the public shape of query results.

## Pages

- [Schema Fundamentals](/schemas/fundamentals): shapes, parsing, defaults, optional values, and native Zod.
- [Field Types and Composition](/schemas/fields): strings, numbers, dates, arrays, records, unions, and nested objects.
- [Validation and Errors](/schemas/validation): understand parse failures and boundary validation.
- [Hidden Fields](/schemas/hidden-fields): protect secrets while retaining validation and explicit access.
- [Registries and Relations](/schemas/relations): connect schemas and define relation graphs.
- [Virtual Fields](/schemas/virtuals): declare and load reverse document relationships.
- [Aggregate Virtuals](/schemas/virtual-aggregates): attach per-owner counts and numeric summaries.
- [Population Scopes](/schemas/scopes): name and reuse relation/virtual-loading policies.
- [Schema Indexes](/schemas/indexes): declare, synchronize, and manage MongoDB indexes.

## A Schema Is More Than a Type

```ts
const account = orm.schema({
  email: orm.email(),
  displayName: orm.string().min(1),
  passwordHash: orm.string().hidden(),
  preferences: orm.object({
    theme: orm.enum(['light', 'dark']),
    digest: orm.boolean().default(true),
  }),
});
```

Persisted fields describe input validation, stored data, default query projection, update input, and TypeScript inference. See [Virtual Fields](/schemas/virtuals) for non-persisted result fields, which are declared and bound separately.
