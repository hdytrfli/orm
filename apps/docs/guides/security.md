---
order: 2
---
# Security and Data Exposure

Treat every query result as an output contract. The safest default is to return less data than the database contains.

## Hide Sensitive Fields

```ts
const user = orm.schema({
  email: orm.string().email(),
  passwordHash: orm.string().hidden(),
  mfaSecret: orm.string().hidden(),
});
```

Use `.show()` only inside a narrowly scoped credential or security service.

## Select Public Fields

```ts
const publicUsers = await db.user
  .filter({ active: true })
  .select(['name', 'avatarUrl']);
```

Explicit selection protects endpoints from exposing fields added later to a schema.

## Restrict Population

Population can expose more data than the base model. Give every populated relation a small `select` list and avoid returning internal foreign keys unless clients need them.

## Authorization Is Separate

Mongorm knows field types and relation structure; it does not know the current user's permissions. Add tenant or ownership predicates in the service layer:

```ts
await db.post.filter({ tenantId, authorId: currentUserId });
```

## Do Not Log Sensitive Documents

A hidden field can still be loaded intentionally. Avoid logging complete model results, query inputs containing credentials, or database errors with secret-bearing context.
