---
order: 3
---

# Escape Hatches

Mongorm covers common schema-driven reads and writes. When an operation needs a MongoDB or Zod capability that Mongorm does not wrap, use the underlying library directly and make the boundary explicit.

## Native MongoDB access with `db.native`

`db.native` exposes the connected MongoDB driver's `Db`. Use it for operations that are not part of the model API, such as:

- Database-level aggregations or raw collection operations that should not use a model's soft-delete policy.
- Change streams and collection-level commands.
- `bulkWrite()` or other specialized write APIs.
- Transactions that need a MongoDB session.

```ts
await db.connect();

const totals = await db.native
  .collection('orders')
  .aggregate([
    { $match: { status: 'paid' } },
    { $group: { _id: '$customerId', total: { $sum: '$amount' } } },
    { $sort: { total: -1 } },
  ])
  .toArray();
```

For aggregation over a model collection, prefer [`Model.aggregate<Result>()`](/queries/aggregation). It gives the output an explicit type and retains the model's default soft-delete filter.

Transactions can use the driver's session API:

```ts
const session = db.native.client.startSession();

try {
  await session.withTransaction(async () => {
    await db.native
      .collection('orders')
      .updateOne({ _id: orderId }, { $set: { status: 'paid' } }, { session });
    await db.native.collection('payments').insertOne(payment, { session });
  });
} finally {
  await session.endSession();
}
```

Use the collection name associated with the schema in `createDatabase({ schemas })`. A direct driver operation does **not** go through the model API, so Mongorm does not apply its create/update validation, hidden-field projection defaults, soft-delete filters, population, or inferred model result types. The MongoDB driver still enforces server-side rules such as indexes and collection validators.

That makes native access useful for specialized operations, but it is not a substitute for ordinary model operations. Keep common application reads and writes on models. If a native write must preserve a Mongorm invariant, enforce that invariant yourself or route the write through the model API instead.

## Advanced Zod access with `schema.definition`

`schema.definition` is the underlying Zod object schema. Use it when you need a Zod operation that is not part of Mongorm's schema API, such as parsing with a custom refinement or deriving a temporary validation schema:

```ts
const userSchema = orm.schema({
  email: orm.email(),
  password: orm.string().min(12),
});

const registrationSchema = userSchema.definition.superRefine((value, context) => {
  if (value.email.endsWith('@example.invalid')) {
    context.addIssue({ code: 'custom', message: 'This email domain is not allowed' });
  }
});

const registration = registrationSchema.parse(request.body);
await db.user.create(registration);
```

The derived Zod schema is a validation tool; it does not modify `userSchema` or add the refinement to Mongorm's model writes. The model still validates against its registered schema. Put invariants that must always apply in the registered field schemas, or validate explicitly at every relevant write boundary.

## Keep the boundary visible

Treat native MongoDB results as driver data, not as inferred Mongorm model results. Validate or narrow them before relying on application-level assumptions, and avoid casting them to a model result type just to silence TypeScript. Prefer a Mongorm model operation whenever it expresses the operation you need.
