---
order: 4
---

# TypeScript

Mongorm uses TypeScript to make schema and query behavior visible at compile time. You do not need to manually maintain a second interface for every collection.

## Pages

- [Inference Fundamentals](/typescript/inference): infer document, input, and visible-result types.
- [Typed Query Composition](/typescript/query-types): how filters, selection, and population change result types.
- [Reusable Application Types](/typescript/application-types): route DTOs, service boundaries, and type aliases.
- [Compiler and Runtime Boundaries](/typescript/boundaries): what TypeScript catches and what runtime validation catches.

## The Core Principle

```ts
const users = await db.user.find({ role: 'admin' }).select(['email', 'name']);

users[0].email; // string
users[0].name; // string
// users[0].passwordHash; // compile-time error when hidden
```

Type inference is a safety net, not a replacement for runtime validation. Data entering the database is parsed by the schema; data leaving the database is shaped by the query.
