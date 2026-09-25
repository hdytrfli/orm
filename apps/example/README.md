# Mongorm examples

Run the complete, deterministic example against the MongoDB connection configured in `.env`:

```sh
pnpm --filter @mongorm/example db
```

The runner resets the configured example collections, then runs each scenario and disconnects. Every feature module creates its own small, clearly named company/team/users/projects/tasks before demonstrating its APIs; examples do not depend on data created by another module. Use a development database: this command purges existing documents in those collections.

Scenarios live in `src/examples/`, grouped by the Mongorm feature they demonstrate:

| File             | Scenarios                                                                                                                                                                                  |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `writes.ts`      | Create/upsert insert and update, idempotent provisioning, bulk imports, task transitions and reassignment, soft-delete visibility, restore, and unmatched updates                          |
| `queries.ts`     | Basic lookup, nested filters, hidden fields, tenant-scoped directory, ranges, `$in`/`$nin`, logical conditions, projection, sorting, pagination, exact/estimated counts, and empty results |
| `relations.ts`   | Simple relation lookup, nested population, selected relation fields, detail scopes, project owner/company context, and no-match relations                                                  |
| `aggregation.ts` | Group/count, average metrics, source filters, pipeline matches, top-N reports, effort totals, and async streaming                                                                          |
| `cursors.ts`     | Seeded directory data, full async streaming for exports, bounded `_id`-ordered cursor pages, and continuation tokens                                                                       |

Add new scenarios to the file for the feature they exercise, or create another feature-focused module and call it from `src/index.ts`. Keep each module's setup near the top so readers can understand exactly which data each scenario uses.

Every scenario uses the regular example logger, with blank lines between labeled operation results to make the console output easier to scan.
