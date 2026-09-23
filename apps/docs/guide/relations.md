# Relations

Relations are declared on the registry. The local schema still contains an `ObjectId` field; the relation definition explains which registered model it points to.

```ts
const groups = orm.schema({
  name: orm.string(),
  creator: orm.objectId().optional(),
});

const users = orm.schema({
  name: orm.string(),
  group: orm.objectId(),
  company: orm.objectId(),
});

const schema = orm
  .defineSchemas({ users, groups, companies })
  .defineRelations({
    groups: {
      creator: 'users',
    },
    users: {
      group: 'groups',
      company: 'companies',
    },
  });
```

The local relation field must be an ObjectId-compatible field. Relation target names are checked against the registry.

## Incorrect Relation Definitions

```ts
const users = orm.schema({
  name: orm.string(),
});

orm.defineSchemas({ users }).defineRelations({
  // Type error: name is not an ObjectId field.
  users: { name: 'groups' },
});
```

```ts
orm.defineSchemas({ users }).defineRelations({
  // Type error: groups is not registered.
  users: { group: 'groups' },
});
```

Relations are not automatically populated. They only become part of the typed population graph.
