# Schema Registry

Register schemas with plural names. The names become typed database model properties and collection names.

```ts
const schema = orm.defineSchemas({
  users: userSchema,
  groups: groupSchema,
  companies: companySchema,
});

const db = createDatabase({
  uri,
  database: 'application',
  schema,
});

await db.users.find({});
await db.groups.find({});
```

The registry keeps schemas separate while providing one place to connect their relation graph and scopes.

## Plural Names Are Intentional

The registry key is used for the model property and default collection name:

```ts
schema.users; // Model for the users collection
db.users;     // Same model exposed by the database handle
```

Use plural keys consistently. If a collection naming strategy is needed later, it should be explicit rather than inferred from singular names.

## Separate Files

A maintainable project usually keeps fields in separate files and assembles the graph in one registry module:

```ts
// schema/user.ts
export const userSchema = orm.schema({
  name: orm.string(),
  group: orm.objectId(),
});

// schema/index.ts
export const schema = orm
  .defineSchemas({ users: userSchema, groups: groupSchema })
  .defineRelations({ users: { group: 'groups' } });
```

This avoids circular imports between individual schema modules while preserving type-safe relation targets.
