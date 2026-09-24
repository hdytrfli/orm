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
  schema: schemas,
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

## Serverless Runtimes

Cache the client outside the request handler when the platform reuses the process. Reconnecting for every invocation adds latency and can exhaust client limits.
