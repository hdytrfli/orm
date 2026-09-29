---
order: 6
---

# Search

Search is opt-in. Declare searchable string paths on the schema registry after schemas and relations are registered:

```ts
const schemas = orm
  .defineSchemas({ users, companies })
  .defineRelations({ users: { company: { ref: 'companies' } } })
  .defineSearches({
    users: ['name', 'profile.location.city', 'company.name'],
  });
```

Paths may refer to scalar string fields on the model or a declared relation target. Nested object paths are supported. ObjectId fields are not searched unless they are declared relations; related target paths must resolve to strings. Invalid paths fail type checking and are validated at runtime. Models omitted from `defineSearches()` have no searchable paths.

`model.features.searchables` exposes the configured paths as frozen runtime metadata. This describes search configuration; it is not an authorization mechanism.

## Querying

```ts
const users = await db.users.find({ active: true }).search('acme').sort({ name: 'asc' }).limit(20);
```

Search is a literal, case-insensitive substring match. It ORs across configured fields and ANDs with the normal `find()` filter. Empty/whitespace-only strings, `null`, and `undefined` are no-ops; other terms are trimmed. User input is escaped before it is used in a regular expression.

When all searchable paths are local, Mongorm adds the search predicate to the normal `find()` filter. When a relation path is included, Mongorm executes one aggregation: first it applies the model filter, then `$lookup`s the declared relation targets and matches local or related string values before sort, skip, and limit. Temporary lookup fields are removed before results are returned. Explicit population and virtual loading retain their existing follow-up behavior.

Exact `.count()` includes the search condition and counts matching documents before pagination. Estimated counts and cursor queries are not supported on searched queries. Regex substring matching can be expensive on large collections; it is not a replacement for a dedicated full-text index or Atlas Search.
