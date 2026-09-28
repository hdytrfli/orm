---
order: 6
---

# Registries and Relations

A relation describes a forward link from an ObjectId field on one schema to the `_id` of another schema. Relations are declared after schemas so the registry can resolve circular references while keeping each schema's stored shape independent from its graph of related models.

For reverse one-to-many lookups and schema-declared virtual fields, see [Virtual Fields](/schemas/virtuals). For named loading policies, see [Population Scopes](/schemas/scopes).

## The schema registry

Register all related schemas under stable names. These names become the keys used by relations, virtual bindings, and database model access:

```ts
const schemas = orm.defineSchemas({
  users: userSchema,
  posts: postSchema,
  comments: commentSchema,
});

const db = createDatabase({
  uri: env.MONGODB_URI,
  database: env.MONGODB_DATABASE,
  schemas,
});

db.users;
db.posts;
db.comments;
```

The registry keeps each schema's inferred type. `db.users` is the model created from the `users` schema, and references such as `ref: 'users'` are checked against the registered schema names.

## Declare a forward relation

The relation map is organized by source schema, then by local field path. Each relation definition has exactly one property:

| Property | Required | Meaning                                                        |
| -------- | -------- | -------------------------------------------------------------- |
| `ref`    | yes      | Registered target schema name. The target key is always `_id`. |

```ts
const userSchema = orm.schema({
  name: orm.string(),
});

const postSchema = orm.schema({
  author: orm.objectId(),
  title: orm.string(),
});

const schemas = orm
  .defineSchemas({
    users: userSchema,
    posts: postSchema,
  })
  .defineRelations({
    posts: {
      author: {
        ref: 'users',
      },
    },
  });
```

This declares that `posts.author` contains the `_id` of a user. It does not automatically load that user or write a reverse property on the user. Relations are metadata for typed, explicit population.

## Relation key requirements

- The source name must be registered in `defineSchemas()`.
- The relation key must be an ObjectId field in that source schema.
- The target name in `ref` must be registered.
- The target field is always `_id`; alternate foreign keys are not configurable.
- Top-level ObjectId fields and ObjectId fields nested inside objects are supported.
- ObjectIds inside arrays are not supported as relation paths.

For nested objects, use a dotted path as the relation key:

```ts
const userSchema = orm.schema({
  profile: orm.object({
    departmentId: orm.objectId(),
  }),
});

const departmentSchema = orm.schema({
  name: orm.string(),
});

const schemas = orm
  .defineSchemas({
    users: userSchema,
    departments: departmentSchema,
  })
  .defineRelations({
    users: {
      'profile.departmentId': {
        ref: 'departments',
      },
    },
  });
```

`orm.objectId()` validates an actual MongoDB `ObjectId`, not a hex string. Parse/convert request strings at the application boundary before using them in a relation field. See [Field Types and Composition](/schemas/fields#mongodb-objectids).

## Load a relation

Relations are opt-in. A normal query returns the local ObjectId but does not load a related document:

```ts
const posts = await db.posts.find({
  title: 'A typed relation',
});
```

Call `.populate()` to load it. A population spec uses the local relation name in `ref`; `fields` and nested `populate` are optional:

```ts
const posts = await db.posts.find({}).populate([
  {
    ref: 'author',
    fields: ['name'],
  },
]);
```

The result has `author: User | null`: missing local IDs and IDs without a matching target resolve to `null`. A populated nested ObjectId path is replaced at that position, so a relation on `profile.departmentId` is returned as `profile.departmentId`, not as a top-level dotted property.

### Population spec properties

| Property   | Required | Meaning                                                               |
| ---------- | -------- | --------------------------------------------------------------------- |
| `ref`      | yes      | Relation key declared on the current model.                           |
| `fields`   | no       | Target projection. Field names are checked against the target schema. |
| `populate` | no       | Nested specs for forward relations on the target model.               |

`fields` uses the same selectors as query projection: visible fields can be named directly, hidden fields require a `+` prefix, and `'$all'` means all normally visible fields. Relation keys needed for nested population may be fetched internally. See [Population](/queries/population) for projection semantics and cost considerations.

## Invalid relation definitions

TypeScript and runtime validation reject unknown schemas, unknown relation paths, non-ObjectId paths, and invalid targets. The API intentionally does not accept `inverse`, `localField`, or `foreignField` properties:

```ts
schemas.defineRelations({
  posts: {
    author: {
      ref: 'users',
      inverse: 'posts', // invalid: declare the reverse side as a virtual
    },
  },
});
```

Use a schema virtual for a reverse collection instead of declaring the reverse name on the forward relation. This makes cardinality explicit and lets multiple virtual fields reuse one edge. See [Virtual Fields](/schemas/virtuals).

## Recommended flow

1. Define and configure each schema independently.
2. Register schemas using `defineSchemas()`.
3. Declare all forward ObjectId relations using `defineRelations()`.
4. Bind any schema virtuals with `defineVirtuals()`.
5. Add reusable loading policies with `defineScopes()`.
6. Create models with `createDatabase()` and load relations explicitly through `.populate()` or `.with()`.

Relations are capabilities, not authorization rules. They do not constrain which filters or sorts an API may accept; application endpoints should validate client-supplied paths against their own allowlists. The [`FieldPathsOf<Model>`](/typescript/model-types#schema-and-operation-types) helper provides the stored path union from which an application can build such an allowlist.
