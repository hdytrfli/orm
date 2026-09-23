# Selection and Projection

Use `select()` to request only selected fields. `_id` remains included by default.

```ts
const users = await db.users.filter().select(['name', 'email']);
```

The selection is typed from the schema:

```ts
const users = await db.users.filter().select(['name']);
users[0].name;
users[0]._id;
// users[0].age; // TypeScript error
```

## Nested Paths

Nested object paths use dot notation:

```ts
const users = await db.users.find({}).select([
  'name',
  'profile.location',
]);
```

Leaf selection is also supported:

```ts
const user = await db.users.find({}).select([
  'profile.location.city',
]);
```

This returns only the requested nested path. Selecting both `profile` and `profile.location.city` selects the parent object; MongoDB cannot project both a parent and one of its children simultaneously.

## Hidden Fields

Hidden fields cannot be selected by default. Use `show()` for an explicit opt-in:

```ts
const user = await db.users.find({}).select(['name']).show(['password']);
```
