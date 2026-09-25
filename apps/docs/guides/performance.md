---
order: 2
---

# Performance

Mongorm makes query intent visible, but MongoDB performance still depends on data volume, indexes, selectivity, and execution plans.

## Project Early

Use `.select()` for list endpoints and relation projections. Smaller documents reduce transfer and deserialization cost.

## Limit Lists

Never return an unbounded collection from a public endpoint. Apply a positive `.limit()` or cursor policy.

## Prefer Cursor Pagination for Deep Lists

Offset pagination is convenient for small pages. Cursor pagination avoids large skips and gives a stable continuation token based on `_id`.

## Avoid Unnecessary Population

Load relations only for views that render them. A detail query may need an author and team; a count query usually does not.

## Index the Access Pattern

Indexes should match common filters and sorts. If a service repeatedly filters by `{ tenantId, status }` and sorts by `createdAt`, evaluate a compound index for that pattern.

## Measure MongoDB Plans

Mongorm does not replace `explain()`. When a query becomes slow, inspect the equivalent MongoDB filter and projection, examine the winning plan, and adjust indexes or query shape based on evidence.
