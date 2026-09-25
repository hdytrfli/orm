---
order: 7
---

# Aggregation

Use `Model.aggregate<Result>(pipeline, options?)` for MongoDB aggregation pipelines. Aggregation stages can reshape documents arbitrarily, so Mongorm does not infer the output shape from the model schema. Provide the result type that matches the final pipeline stage for precise hints. Without one, result fields are `unknown` rather than unsafely inferred as `any`.

```ts
type TaskCountByStatus = {
  _id: string;
  count: number;
};

const counts = await db.tasks.aggregate<TaskCountByStatus>([
  { $group: { _id: '$status', count: { $sum: 1 } } },
  { $sort: { count: -1 } },
]);

counts[0]?.count; // number
```

The pipeline is typed against both the source schema and the explicit result type. Mongorm gives field-aware hints for `$match`, `$group`, `$sort`, `$project`, `$set`, `$addFields`, `$unwind`, `$unset`, and `$sortByCount`. For example, `$group` output keys must match the declared result type, accumulator field references are checked against known source/result fields, and `$sort` only accepts known source/result fields. The returned aggregate query follows Mongorm's awaitable query pattern: `await` resolves to `Result[]`, and `for await...of` streams results without loading the full result set into memory. Driver aggregation options such as `allowDiskUse` can be passed as the second argument.

The typed pipeline also supports `$limit`, `$skip`, `$count`, `$geoNear`, `$search`, `$vectorSearch`, `$lookup`, `$graphLookup`, `$facet`, `$bucket`, `$bucketAuto`, `$unionWith`, `$replaceRoot`, `$replaceWith`, `$out`, `$merge`, `$densify`, `$fill`, and `$setWindowFields`. Common `$group` accumulators include `$sum`, `$avg`, `$min`, `$max`, `$first`, `$last`, `$push`, `$addToSet`, and `$count`.

MongoDB's expression language is open-ended, so nested operator expressions and advanced specifications (for example, the contents of `$lookup` or `$search`) use driver-level `Document` values rather than pretending to validate every MongoDB expression. If a stage is not in the model pipeline's stage union, run it through `db.native.collection(name).aggregate(...)`; this lower-level escape hatch does not apply Mongorm's soft-delete filter. Without an explicit `Result`, output fields stay `unknown`; supplying `Result` is what makes group keys, result matches, and result sorts precise.

The query is lazy. Awaiting it opens a cursor and collects the results into an array; iterating it opens a cursor and streams each result:

```ts
const query = db.tasks.aggregate<TaskCountByStatus>([
  { $group: { _id: '$status', count: { $sum: 1 } } },
]);

for await (const count of query) {
  console.log(count._id, count.count);
}
```

Each execution opens a fresh MongoDB cursor. Avoid awaiting and iterating the same query unless you intentionally want to run the aggregation twice.

Unlike the native driver cursor, the aggregate query intentionally has no `.toArray()` method. Use `await` when you want an array and async iteration when the result may be large.

Use the `filter` option when you want to add a schema-checked filter to the source documents before any transformations:

```ts
const completed = await db.tasks.aggregate<TaskCountByStatus>(
  [{ $group: { _id: '$status', count: { $sum: 1 } } }],
  { filter: { status: 'done' } },
);
```

The `filter` option uses `ModelFilter<Shape>`, so field names and values are checked against the model schema. Pipeline `$match` stages are also checked against source fields or the declared result fields, which is useful for matching transformed values. Use the explicit `filter` option for the initial source filter when possible.

## Soft-delete behavior

For a schema configured with `softdelete: true`, aggregation excludes deleted source documents by default, just like `find()`. Mongorm adds a `{ deletedAt: null }` condition to a `$match` before the supplied stages. If you also pass `options.filter`, the two conditions are combined with `$and`.

MongoDB requires some stages to appear first. Mongorm keeps `$geoNear`, `$search`, and `$vectorSearch` first and inserts its soft-delete match immediately after that stage:

```ts
type NearbyPlace = { name: string; distanceMeters: number };

const nearestPlaces = await db.places.aggregate<NearbyPlace>([
  {
    $geoNear: {
      near: { type: 'Point', coordinates: [-122.4, 37.8] },
      distanceField: 'distanceMeters',
      spherical: true,
    },
  },
  { $limit: 20 },
]);
```

This means later stages see only active source documents. If you need deleted documents too, pass `includeDeleted: true`. This option is available only on models whose schema enables soft deletion:

```ts
const auditCounts = await db.tasks.aggregate<TaskCountByStatus>(
  [{ $group: { _id: '$status', count: { $sum: 1 } } }],
  { includeDeleted: true },
);
```

Some stages produce metadata or change events rather than model documents and are intentionally not part of the model pipeline type: `$changeStream`, `$searchMeta`, `$collStats`, `$indexStats`, `$planCacheStats`, and `$documents`. Use `db.native` for these lower-level operations. `$documents` is normally used with database-level aggregation; for change streams, prefer the native collection `watch()` API. If JavaScript or a cast supplies one of these stages while a model filter is active, Mongorm rejects it rather than silently skipping the filter.

`includeDeleted: true` disables only Mongorm's implicit soft-delete condition. Any explicit `filter` option is still applied.

The default filter applies to the model's source collection only. It does not add soft-delete filters inside `$lookup` or `$unionWith` pipelines that read other collections. Add those filters explicitly when required.

## Validation and model behavior

Aggregation results are not parsed through the schema. Mongorm does not apply hidden-field projections or populate declared relations to aggregate output. The explicit result type is only a TypeScript declaration; it does not validate the returned documents at runtime. Validate untrusted or legacy data yourself.

Stages such as `$out` and `$merge` can write to collections. Those writes bypass model create/update validation and model lifecycle behavior. Use them only when you deliberately want MongoDB's native pipeline write semantics.

For ordinary document reads, prefer `find()` so you keep its schema-checked filter, hidden-field behavior, soft-delete handling, and typed selection/population. Use aggregation when the data transformation itself needs MongoDB's pipeline operators.
