---
order: 2
---
# Schemas

Schemas are the source of truth for document validation, field inference, hidden-field behavior, relation keys, and the public shape of query results.

## Pages

- [Schema Fundamentals](/schemas/fundamentals): shapes, parsing, defaults, optional values, and native Zod.
- [Field Types and Composition](/schemas/fields): strings, numbers, dates, arrays, records, unions, and nested objects.
- [Hidden Fields](/schemas/hidden-fields): protect secrets while retaining validation and explicit access.
- [Registries and Relations](/schemas/relations): connect schemas and define relation graphs.
- [Population Scopes](/schemas/scopes): name and reuse relation-loading policies.
- [Validation and Errors](/schemas/validation): understand parse failures and boundary validation.

## A Schema Is More Than a Type

```ts
const account = orm.schema({
  email: orm.string().email(),
  displayName: orm.string().min(1),
  passwordHash: orm.string().hidden(),
  preferences: orm.object({
    theme: orm.enum(['light', 'dark']),
    digest: orm.boolean().default(true),
  }),
});
```

This definition simultaneously describes input validation, stored data, default query projection, update input, and TypeScript inference.
