# Installation

Install the ORM and its peer runtime dependencies with your package manager.

```bash
pnpm add @mongorm/orm
```

```bash
npm install @mongorm/orm
```

The package depends on `mongodb` and `zod`. They are installed transitively, but applications should normally manage their MongoDB connection string and runtime configuration directly.

## TypeScript Configuration

Mongorm is an ES module package and is intended for modern TypeScript projects. Use a Node-compatible module configuration such as `NodeNext` or a bundler configuration that supports package exports.

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true
  }
}
```

## MongoDB Connection

Mongorm does not start MongoDB for you. Provide a normal MongoDB URI and database name:

```ts
const db = createDatabase({
  uri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
  database: process.env.MONGODB_DATABASE ?? 'application',
  schema,
});
```

Call `connect()` before queries and `disconnect()` during shutdown.
