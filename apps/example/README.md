# Mongorm integration tests

The example package is a Vitest integration suite. Its scenarios use the configured MongoDB database and verify behavior with assertions; they do not print demo output or modify application data outside the example collections.

```sh
# Run every scenario
pnpm --filter @mongorm/test test

# Run one feature file
pnpm --filter @mongorm/test test -- tests/virtual.test.ts

# Pick a scenario by its title
pnpm --filter @mongorm/test test -- -t "negative"
```

Configure `MONGODB_URI` and `MONGODB_DATABASE` in the repository `.env` before running the tests. Use a development database: scenarios clear and repopulate their dedicated collections between runs.

Tests are grouped by feature in `tests/`; scenario titles describe their intent (simple, negative, best case, complex, or real-world). Keep setup local to the feature test and assert the observable result so each scenario can be run and understood independently.

| Test file             | Coverage                                                                                                                                                                |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `database.test.ts`    | Destructive purge and index-drop warnings, quiet overrides, deletion totals, and post-purge state.                                                                      |
| `queries.test.ts`     | Nested-field projection, empty matches/counts, hidden fields, missing optional fields, exact/estimated counts, tenant isolation, logical/range filters, and pagination. |
| `relations.test.ts`   | Selected forward population, nested detail scopes, and missing related documents.                                                                                       |
| `virtual.test.ts`     | Reverse matches, no children/no parents, projected join keys, per-parent matching, field selection, scopes, nested population, and tenant-directory output.             |
| `writes.test.ts`      | Create/update, idempotent upsert, bulk insertion, validation failures, unmatched writes, and soft-delete/restore lifecycle.                                             |
| `aggregation.test.ts` | Tenant-filtered grouping/metrics and empty aggregation results.                                                                                                         |
| `cursors.test.ts`     | Unlimited async streaming and bounded continuation pages.                                                                                                               |
