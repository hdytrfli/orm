---
order: 2
---

# ORM and Schema API

## `orm.schema(shape)`

Creates a schema from a record of Zod fields.

```ts
const user = orm.schema({
  name: orm.string(),
});
```

The returned schema supports parsing and carries the field metadata used by models and query types. Configure persistence behavior with `.options()` and indexes with `.indexes()`. Define relations, virtual bindings, population scopes, and search paths on a schema registry with `defineRelations()`, `defineVirtuals()`, `defineScopes()`, and `defineSearches()`.

The underlying Zod object is available as `schema.definition` for advanced Zod composition. A derived Zod schema does not change the schema registered with a model; see [Escape Hatches](/guides/escape-hatches) for details.

## Native Zod Constructors

`orm` exposes lowercase callable Zod constructors, including `string`, `number`, `boolean`, `object`, `array`, `record`, `union`, `literal`, `enum`, and the constructors available in the installed Zod version.

```ts
orm.string().min(1);
orm.array(orm.string());
orm.object({
  enabled: orm.boolean(),
});
```

## `orm.objectId()`

Creates a Zod field for MongoDB `ObjectId` values.

It validates `ObjectId` instances, not hexadecimal strings. Convert strings at the request boundary. ObjectId fields can be used as relation keys in `defineRelations()`; see [Registries and Relations](/schemas/relations).

## `orm.virtual(kind)`

Declares a non-persisted virtual result field in a schema shape:

```ts
const user = orm.schema({
  posts: orm.virtual('many'),
  postCount: orm.virtual('count'),
});
```

Valid kinds are `many`, `first`, `count`, `distinct`, `sum`, `avg`, `min`, `max`, and `median`. Bind every declaration with `defineVirtuals()`; every aggregate kind requires `field`. `sum`, `avg`, `min`, `max`, and `median` require numeric fields, while `count` and `distinct` require scalar fields. See [Virtual Fields](/schemas/virtuals) and [Aggregate Virtuals](/schemas/virtual-aggregates) for binding properties and result types.

## `.hidden()`

Marks a field as excluded from default model projections. Hidden fields can be requested explicitly with a `+` selector in `.fields()`.

## `schema.options(options)`

Enables managed persistence behavior once per schema:

```ts
const user = orm
  .schema({
    name: orm.string(),
  })
  .options({
    timestamps: true,
    softdelete: true,
    hideManaged: true,
    collection: 'app_users',
  });
```

- `timestamps` manages `createdAt` and `updatedAt`.
- `softdelete` manages nullable `deletedAt` and filters deleted documents from normal reads.
- `hideManaged` hides whichever managed fields are enabled from default query results. Use a `+` selector in `.fields()` to include them explicitly. It affects query projections; mutation methods such as `create()` and `update()` still return the full document.
- `collection` overrides the physical MongoDB collection name. The registry key remains the model name and the name used by relation definitions.

These are the supported schema options. Configure them together in a single `.options({...})` call; calling `.options()` again on the same schema throws. See [Schema Fundamentals](/schemas/fundamentals#managed-persistence-options) for lifecycle behavior.

## `schema.coerced`

`schema.definition` and Mongorm writes remain strict. For transport data such as HTTP request bodies, `schema.coerced` provides a separate Zod parser that converts common string representations before validating with the original schema:

```ts
const userSchema = orm.schema({
  age: orm.number(),
  active: orm.boolean(),
});

const input = userSchema.coerced.parse({ age: '42', active: 'false' });
// { age: 42, active: false }
```

It handles numeric strings, `stringbool()` boolean strings, date strings, ObjectId hex strings, and nested values in objects and arrays. The original field validators still run on the converted values. Use this explicitly at the transport boundary; `create()`, `update()`, `schema.parse()`, and `.definition.parse()` continue to reject values that do not match their strict schema inputs.

## `schema.indexes(definitions)`

Declares indexes for explicit creation by `db.sync()`. Each definition has `fields` (a non-empty map of schema field names to MongoDB index directions) and optional `options` (MongoDB index options, including a schema-checked `partialFilterExpression`). Index declarations do not create indexes until synchronization. See [Schema Indexes](/schemas/indexes) for examples and index lifecycle methods.

## `orm.defineSchemas(registry)`

Creates a typed registry from named schemas.

```ts
const schemas = orm.defineSchemas({
  user,
  post,
});
```

## `.defineRelations(definitions)`

Adds relation metadata to a registry. Each source field maps to a target registry key:

```ts
schemas.defineRelations({
  post: {
    author: {
      ref: 'user',
    },
  },
});
```

The only relation property is `ref`; it names the target schema, whose `_id` is matched to the local ObjectId field. The local field must exist and be an ObjectId (a nested dot path is allowed). No inverse or alternate target-field option is supported.

## `.defineVirtuals(definitions)`

Resolves schema-declared virtuals to related schemas and relation fields:

```ts
schemas
  .defineRelations({
    post: {
      author: {
        ref: 'user',
      },
    },
  })
  .defineVirtuals({
    user: {
      posts: {
        ref: 'post',
        via: 'author',
      },
    },
  });
```

Each binding has required `ref` and `via` properties. Aggregate bindings also require `field`: numeric for `sum`, `avg`, `min`, `max`, and `median`, scalar for `count` and `distinct`. The `via` relation must point back to the virtual's owner. Every declared virtual must be bound; undeclared, missing, duplicate, or invalid bindings fail validation. See [Virtual Fields](/schemas/virtuals) and [Aggregate Virtuals](/schemas/virtual-aggregates) for kinds and query usage.

## `.defineSearches(definitions)`

Opt schemas into substring search by listing scalar string field paths. It is declared after `defineRelations()` so relation paths can be checked:

```ts
schemas
  .defineRelations({ users: { company: { ref: 'companies' } } })
  .defineSearches({ users: ['name', 'profile.city', 'company.name'] });
```

Unknown schemas, non-string fields, and invalid relation paths are rejected. Models not included have no searchable paths. See [Search](/queries/search) for matching semantics and query execution.

## `.defineScopes(definitions)`

Adds named population specifications to registry schemas:

```ts
schemas.defineScopes({
  post: {
    detail: [
      {
        ref: 'author',
        fields: ['name'],
      },
    ],
  },
});
```

Each schema maps scope names to arrays of relation or virtual population specs. Scopes are run from that schema's model query using `.with('scopeName')`; only names defined on that model are accepted. See [Population Scopes](/schemas/scopes) for spec properties, nested relations, and composition rules.
