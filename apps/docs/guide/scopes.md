# Population Scopes

Scopes name commonly used population graphs:

```ts
const schema = orm
  .defineSchemas({ users, groups, companies })
  .defineRelations({
    users: { group: 'groups', company: 'companies' },
    groups: { creator: 'users' },
  })
  .defineScopes({
    users: {
      detail: [
        {
          ref: 'group',
          select: ['name'],
          populate: [{ ref: 'creator' }],
        },
        { ref: 'company', select: ['name'] },
      ],
    },
  });
```

Apply the scope in a query:

```ts
const users = await db.users.filter({ role: 'admin' }).with('detail');
```

Scope names and relation refs are inferred from the registry. Invalid names are compile-time errors.

```ts
db.users.filter().with('missing'); // TypeScript error
```

Do not combine APIs:

```ts
db.users.filter().with('detail').populate([]); // TypeScript error
db.users.filter().populate([]).with('detail'); // TypeScript error
```

Use scopes for stable application-level read models, such as `summary`, `detail`, and `admin`. Keep highly specific one-off projections as explicit population specs.
