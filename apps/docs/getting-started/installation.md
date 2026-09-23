---
order: 1
---
# Installation

Mongorm is a small layer over the official MongoDB Node.js driver. Install both packages in the application that owns the database connection.

```bash
pnpm add @mongorm/orm mongodb
```

```bash
npm install @mongorm/orm mongodb
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

```ts
const uri = process.env.MONGODB_URI;
const databaseName = process.env.MONGODB_DATABASE;

if (!uri || !databaseName) {
  throw new Error('MONGODB_URI and MONGODB_DATABASE are required');
}
```

Do not create a new `MongoClient` for every request. Create one database handle during application startup and reuse it.

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

console.log(db.healthCheck.name);
await db.disconnect();
```

If this runs, package resolution and database construction are working. It does not yet perform a database operation.
