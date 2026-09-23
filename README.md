<p align="center">
  <img src="./.github/assets/backdrop.svg" alt="Mongorm" width="100%" />
</p>

<h1 align="center">Mongorm</h1>

<p align="center">
  TypeScript-first MongoDB ORM with a small, strongly typed API.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" />
  <img src="https://img.shields.io/badge/Zod-3E67B1?style=for-the-badge&logo=zod&logoColor=white" alt="Zod" />
  <img src="https://img.shields.io/badge/pnpm-F69220?style=for-the-badge&logo=pnpm&logoColor=white" alt="pnpm" />
  <img src="https://img.shields.io/badge/Vitest-6E9F18?style=for-the-badge&logo=vitest&logoColor=white" alt="Vitest" />
  <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=for-the-badge&logo=github-actions&logoColor=white" alt="GitHub Actions" />
</p>

Built on the official MongoDB driver, Zod, and pnpm.

## Development

```bash
pnpm install
pnpm check
pnpm dev
```

The runnable example is in `apps/example`. Set `MONGODB_URI` and `MONGODB_DATABASE` in its environment before running the database script.

## Indexes

Declare indexes on a schema and synchronize them explicitly after connecting:

```ts
const userSchema = orm
  .schema({ email: orm.string(), company: orm.objectId() })
  .indexes([{ fields: { company: 1, email: 1 }, options: { unique: true } }]);

await db.connect();
await db.sync();
```

Index creation is never automatic.

## Versioning

Package versions are kept together. Bump them with one of:

```bash
pnpm version:bump patch
pnpm version:bump minor
pnpm version:bump major
pnpm version:bump 1.0.0
```

`bumpp` updates both workspace versions, creates the commit and tag, and leaves pushing to you. Push the commit and tag, then create a GitHub release with the matching tag, for example `v1.0.0`. The release workflow publishes `@mongorm/orm` to npm.

## License

MIT
