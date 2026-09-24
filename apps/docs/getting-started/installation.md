---
order: 1
---

# Installation

Mongorm includes the official MongoDB Node.js driver as a runtime dependency. Install the ORM package in the application that owns the database connection.

```bash
pnpm add @mongorm/orm
```

```bash
npm install @mongorm/orm
```

## Requirements

- Node.js with native ESM support.
- TypeScript configured for modern module resolution.
- A MongoDB deployment reachable from the application.
- `strict` TypeScript checking recommended.

## Environment Configuration

Keep the URI outside source control:

```bash
MONGODB_URI=mongodb://127.0.0.1:27017
MONGODB_DATABASE=example
```

## TypeScript Configuration

Mongorm publishes ESM-compatible modules. A modern configuration is the safest starting point:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "verbatimModuleSyntax": true
  }
}
```

## Verify the Installation

```ts
import { createDatabase, orm } from '@mongorm/orm';

const schemas = orm.defineSchemas({
  healthCheck: orm.schema({ value: orm.string() }),
});

const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: process.env.MONGODB_DATABASE!,
  schema: schemas,
});

await db.connect();

await db.healthCheck.create({ value: 'connected' });
console.log(await db.healthCheck.find());
await db.healthCheck.delete({ value: 'connected' });

await db.disconnect();
```

This checks package resolution, connection, and a basic create/read/delete round trip.
