---
order: 3
---

# Selection and Projection

Without `.fields()`, a query returns all visible schema fields plus `_id`. Hidden fields are excluded by default.

```ts
const users = await db.user.find({ active: true });
```

## Select Fields

```ts
const users = await db.user.find({ active: true }).fields(['name', 'email']);
```

`_id` remains in the result. The TypeScript result contains only `_id`, `name`, and `email` from this selection.

## Select Nested Paths

```ts
const user = await db.user.find({ _id: id }).fields(['name', 'profile.avatarUrl']);
```

Nested selections are normalized so a parent path does not conflict with one of its child paths. The nested result remains shaped as an object rather than a flattened key.

## Include Hidden Fields

```ts
const user = await db.user.find({ _id: id }).fields(['$all', '+passwordHash']);
```

Prefix a schema-hidden field with `+`. `'$all'` selects all normally visible fields, so it can be combined with a hidden field. Without `'$all'`, the list is an explicit selection; for example, `fields(['+passwordHash'])` returns only `_id` and the hidden password hash.

## `fields` Selector Reference

The same selector syntax is used by query-level `.fields()` and by population specs. With no
`.fields()` call, queries return all normally visible fields. When a selector list is provided:

| Selector                    | Result                                                                     |
| --------------------------- | -------------------------------------------------------------------------- |
| `['name']`                  | `_id` and `name` only                                                      |
| `[]`                        | `_id` only                                                                 |
| `['name', '+passwordHash']` | `_id`, `name`, and the hidden `passwordHash`                               |
| `['$all']`                  | All normally visible fields (equivalent to the default visible projection) |
| `['$all', '+passwordHash']` | All normally visible fields and `passwordHash`                             |
| `['+passwordHash']`         | `_id` and `passwordHash` only                                              |

Field names and `+`-prefixed hidden fields are checked against the relevant schema. `'$all'` is a
reserved selector, not a schema field name.

## Selection and Population

Relation selection belongs inside the population specification:

```ts
const posts = await db.post.find({}).populate([
  {
    ref: 'author',
    fields: ['name', 'avatarUrl'],
  },
]);
```

Nested population automatically retains the local key needed to resolve the nested relation, even if that key was not part of the visible selection.

## Projection Guidance

Select fields at API boundaries, especially list endpoints. A field projection reduces network transfer, makes response contracts clearer, and prevents future schema additions from silently expanding an endpoint.
