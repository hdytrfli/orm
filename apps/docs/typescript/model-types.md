---
order: 2
---

# Model-Derived Types

Mongorm exports type helpers for cases where a type needs to be named or passed across a generic boundary. Each helper takes a registered model type, typically `typeof db.user`. These are compile-time types; they do not create runtime values or replace schema validation.

```ts
import type {
  CreateInputOf,
  CoercedOf,
  FieldPathsOf,
  FilterOf,
  PopulateOf,
  RelationPathsOf,
  ShapeOf,
  UpdateInputOf,
} from '@mongorm/orm';

type UserShape = ShapeOf<typeof db.user>;
type NewUser = CreateInputOf<typeof db.user>;
type UserRequestSchema = CoercedOf<typeof db.user>;
type UserUpdate = UpdateInputOf<typeof db.user>;
type UserFilter = FilterOf<typeof db.user>;
type UserFieldPath = FieldPathsOf<typeof db.user>;
type UserPopulation = PopulateOf<typeof db.user>;
type PostRelationFieldPath = RelationPathsOf<typeof db.post>;
```

## Schema and operation types

| Helper                   | Derived type                                                                                                           |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| `AnyModel`               | Any Mongorm `Model` type; useful as a generic constraint.                                                              |
| `ShapeOf<Model>`         | The field shape registered on the model.                                                                               |
| `FieldPathsOf<Model>`    | Stored field paths, including parent and dotted nested paths; virtuals are excluded.                                   |
| `RelationPathsOf<Model>` | Related stored field paths prefixed by their relation name, such as `author.email`; target virtuals are excluded.      |
| `CreateInputOf<Model>`   | The validated input accepted by that model's `create()`.                                                               |
| `UpdateInputOf<Model>`   | The partial update input accepted by that model's update operation.                                                    |
| `FilterOf<Model>`        | A schema-aware MongoDB filter for the model, including a direct `_id: ObjectId` lookup form.                           |
| `ZodSchemaOf<Model>`     | A Zod schema compatible with the model's create input and with a `.partial()` schema compatible with its update input. |
| `CoercedOf<Model>`       | A Zod parser compatible with the model's coerced schema and parsed output type.                                        |

Create and update inputs account for the model's schema options. For example, managed fields and generated `_id` are not ordinary caller-supplied create fields. Prefer these helpers over manually rebuilding input types from the schema shape.

`FieldPathsOf<Model>` provides the schema-wide candidate paths for app-specific filter or sort allowlists. It includes hidden and managed fields, so each application can intentionally omit sensitive or unsuitable paths; it is a type helper, not a runtime authorization policy.

```ts
import type { FieldPathsOf } from '@mongorm/orm';

const userFilterFields = [
  'email',
  'role',
  'profile.location.city',
] as const satisfies readonly FieldPathsOf<typeof db.user>[];

type UserFilterField = (typeof userFilterFields)[number];

const isUserFilterField = (value: string): value is UserFilterField =>
  userFilterFields.some((field) => field === value);
```

Use the resulting narrow union when validating client-supplied filter paths before constructing a Mongorm filter. Keep the runtime check: the type helper only verifies that the allowlist itself uses real schema paths. It does not sanitize untrusted input automatically. Parent paths such as `profile` and `profile.location` are included as well as leaf paths, so only put paths in the application allowlist that the endpoint intends to expose.

Use `RelationPathsOf<Model>` when an endpoint supports searching/filtering by fields on populated relations. It prefixes every persisted target path with its local relation key, and includes hidden fields so the application can explicitly leave sensitive ones out:

```ts
import type { RelationPathsOf } from '@mongorm/orm';

const searchablePostRelations = ['author.name'] as const satisfies readonly RelationPathsOf<
  typeof db.post
>[];
```

This helper describes paths that exist in the related schema; it does not make the query builder accept relation-field filters directly. Your application still needs to validate the path and translate it into the appropriate query or aggregation.

`ZodSchemaOf` is useful when an abstraction accepts one schema and uses it for both create and partial-update validation:

```ts
import type { AnyModel, ZodSchemaOf } from '@mongorm/orm';

function registerCrudSchema<Model extends AnyModel>(schema: ZodSchemaOf<Model>) {
  const createValidator = schema;
  const updateValidator = schema.partial();
  return { createValidator, updateValidator };
}
```

The model type is explicit in that generic example. In regular application code, use the concrete schema directly and let TypeScript infer inputs from the model methods.

Use `CoercedOf<Model>` to type a transport validator that parses string-heavy input with the model's `schema.coerced` parser:

```ts
import type { AnyModel, CoercedOf } from '@mongorm/orm';

function parseRequest<Model extends AnyModel>(schema: CoercedOf<Model>, input: unknown) {
  return schema.parse(input);
}

const parsedUser = parseRequest<typeof db.user>(userSchema.coerced, request.body);
// Parsed field values have the model schema's output types.
```

## Relations, scopes, and population

| Helper                  | Derived type                                                            |
| ----------------------- | ----------------------------------------------------------------------- |
| `RelationsOf<Model>`    | The model's declared relation map.                                      |
| `VirtualsOf<Model>`     | The model's declared virtual-relation map.                              |
| `ScopesOf<Model>`       | The model's named population scopes.                                    |
| `PopulateOf<Model>`     | Valid population specifications for the model's relations and virtuals. |
| `ModelScopeName<Model>` | The string names of scopes available on the model.                      |

For example, a reusable helper can accept only population specifications valid for its model:

```ts
import type { PopulateOf } from '@mongorm/orm';

function loadUsers(populate: PopulateOf<typeof db.user>) {
  return db.user.find({}).populate(populate);
}
```

These types describe declared capabilities. Relations and scopes are still loaded only when a query explicitly calls `.populate()` or `.with()`.

## Schema configuration and results

| Helper                          | Derived type                                                                       |
| ------------------------------- | ---------------------------------------------------------------------------------- |
| `OptionsOf<Model>`              | The model's schema options, including managed-field and soft-delete configuration. |
| `IndexesOf<Model>`              | The index definitions registered on the model.                                     |
| `ModelSoftDeleteEnabled<Model>` | Whether the model's schema enables soft deletion.                                  |
| `ModelFilter<Shape>`            | A schema-aware MongoDB filter parameterized by a schema shape.                     |
| `ModelSort<Shape>`              | Sort fields and directions supported by the model shape.                           |
| `SelectedDocument<...>`         | A selected query-result shape.                                                     |
| `VisibleDocument<...>`          | The model's default visible query-result shape.                                    |
| `StoredDocument<...>`           | The document shape stored in MongoDB, including managed fields.                    |
| `PopulatedResult<...>`          | A result shape after population instructions are applied.                          |

Result helpers have more type parameters because they represent intermediate query states. Most consumers should use the type inferred from a query rather than naming these types manually. See [Typed Query Composition](/typescript/query-types) for how selection and population affect inferred results.

## Choosing the right helper

- Use `CreateInputOf<Model>` or `UpdateInputOf<Model>` when a function accepts model operation input.
- Use `FilterOf<Model>` when a reusable function accepts filters for one model.
- Use `PopulateOf<Model>` when a function accepts relation-loading instructions.
- Use `ShapeOf<Model>` and the relation/scope extractors when building generic libraries around model metadata.
- Prefer inferred query results for ordinary reads; avoid widening them to `VisibleDocument` or another broad type unless a shared API truly needs that abstraction.
- For runtime schema capability metadata, see [`Model.features`](/reference/models#model-features).
