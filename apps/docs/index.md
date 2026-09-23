# Mongorm

TypeScript-first MongoDB ORM documentation.

Mongorm combines MongoDB, native Zod schemas, and TypeScript inference into a small API for building schema-driven data access layers.

<div class="vp-doc">

<a class="VPButton medium brand" href="/guide/introduction">Read the guide</a>
<a class="VPButton medium alt" href="/guide/quick-start">Start quickly</a>

</div>

## What Mongorm Provides

- Native Zod constructors and validation.
- Type-safe MongoDB filters, sorting, selection, updates, and population.
- Central schema registries with plural model access such as `db.users`.
- Reusable relation definitions and named population scopes.
- Recursive nested population with inferred result types.
- Cursor pagination, exact counts, and estimated counts.
- Hidden fields that remain validated but are omitted from default results.

```ts
const users = await db.users
  .filter({ role: 'admin' })
  .with('detail');
```
