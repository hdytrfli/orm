---
order: 4
---
# Runtime Lifecycle

MongoDB connections are process resources. Mongorm creates models around a supplied database; it does not remove the need to manage the client lifecycle.

## Startup

```ts
const db = createDatabase({ uri, database: name, schema: schemas });
await db.connect();
```

Construct the database handle only after the client is connected when your application needs startup connectivity checks.

## Requests

Reuse the same `db` object for every request. Models and schemas are safe to share because query builders hold operation-specific state.

```ts
app.get('/users', async (_request, response) => {
  const users = await db.user.filter({ active: true });
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

Cache the client outside the request handler when the platform reuses the process. Reconnecting for every invocation adds latency and can exhaust connection limits.
