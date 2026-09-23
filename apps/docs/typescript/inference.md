---
order: 1
---
# Inference Fundamentals

Mongorm infers document types from the schema instead of asking you to duplicate them in interfaces.

```ts
const user = orm.schema({
  name: orm.string(),
  age: orm.number().int(),
  passwordHash: orm.string().hidden(),
});
```

The schema's inferred document has `name`, `age`, `passwordHash`, and the generated `_id` once stored. A normal query result has the visible fields and `_id`, but not `passwordHash`.

## Let the Model Infer Results

```ts
const users = await db.user.filter({ age: { $gte: 18 } });

for (const user of users) {
  user.name;
  user.age;
  user._id;
  // user.passwordHash; // not available by default
}
```

Avoid manually annotating `users` with a broad document type. That can erase the useful narrowing provided by selection and hidden fields.

## Inputs and Outputs Differ

Create input does not include generated `_id`:

```ts
await db.user.create({ name: 'Ada', age: 36, passwordHash: 'hash' });
```

The returned document includes `_id`. An update input is partial and excludes `_id`.

## Hidden Field Inference

```ts
const account = await db.user.find({ _id: id }).show(['passwordHash']);
account?.passwordHash;
```

`.show()` explicitly expands the result type. This makes sensitive access visible during code review and in editor tooling.
