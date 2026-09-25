---
order: 4
---

# Runtime Lifecycle

MongoDB connections are process resources. `createDatabase()` owns the underlying client, while your application controls when the database handle connects and disconnects.

## Startup

```ts
const db = createDatabase({
  uri,
  database: name,
  schemas,
});

await db.connect();
```

Construct the database handle first, then call `connect()` before any model operation. Keep and reuse this handle for the lifetime of the process.

## Requests

Reuse the same `db` object for every request. Models and schemas are safe to share because query builders hold operation-specific state.

```ts
app.get('/users', async (_request, response) => {
  const users = await db.user.find({ active: true });
  response.json(users);
});
```

## Shutdown

```ts
const shutdown = async () => {
  await db.disconnect();
  process.exit(0);
};

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);
```

## Test Cleanup

`db.unsafe.purge()` permanently deletes every document in every collection registered with that database handle. It bypasses model-level filters such as soft-delete behavior and writes no data. Mongorm prints a warning by default; pass `{ quiet: true }` to suppress it when the destructive operation is intentional, such as clearing a dedicated integration-test database.

```ts
const deletedDocuments = await db.unsafe.purge({ quiet: true });
```

Use this only with a database that is safe to empty. The method returns the total number of deleted documents.

`db.sync({ dropIndexes: true })` also warns before dropping indexes from registered collections and then recreating the indexes declared by their schemas. Pass `quiet: true` only when that destructive index reset is intentional.

```ts
await db.sync({ dropIndexes: true, quiet: true });
```

## Serverless Runtimes

Cache the client outside the request handler when the platform reuses the process. Reconnecting for every invocation adds latency and can exhaust client limits.
