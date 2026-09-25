---
order: 3
---

# Selection and Projection

Without `.select()`, a query returns all visible schema fields plus `_id`. Hidden fields are excluded by default.

```ts
const users = await db.user.find({ active: true });
```

## Select Top-Level Fields

```ts
const users = await db.user.find({ active: true }).select(['name', 'email']);
```

`_id` remains in the result. The TypeScript result contains only `_id`, `name`, and `email` from this selection.

## Select Nested Paths

```ts
const user = await db.user.find({ _id: id }).select(['name', 'profile.avatarUrl']);
```

Nested selections are normalized so a parent path does not conflict with one of its child paths. The nested result remains shaped as an object rather than a flattened key.

## Show Hidden Fields

```ts
const user = await db.user.find({ _id: id }).show(['passwordHash']);
```

The field must be declared hidden in the schema and listed explicitly. Use `.show()` only where the value is required.

## Selection and Population

Relation selection belongs inside the population specification:

```ts
const posts = await db.post.find({}).populate([
  {
    ref: 'author',
    select: ['name', 'avatarUrl'],
  },
]);
```

Nested population automatically retains the local key needed to resolve the nested relation, even if that key was not part of the visible selection.

## Projection Guidance

Select fields at API boundaries, especially list endpoints. A projection reduces network transfer, makes response contracts clearer, and prevents future schema additions from silently expanding an endpoint.
