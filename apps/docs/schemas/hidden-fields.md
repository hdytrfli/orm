---
order: 5
---

# Hidden Fields

Mark a field with `.hidden()` when it should be stored and validated but excluded from the default result projection.

```ts
const user = orm.schema({
  email: orm.email(),
  passwordHash: orm.string().hidden(),
  recoveryToken: orm.string().optional().hidden(),
});
```

## Default Behavior

```ts
const users = await db.user.find({ email: 'ada@example.com' });
```

The result includes visible fields and `_id`, but not `passwordHash` or `recoveryToken`. Hidden fields are not merely omitted from TypeScript; the generated projection also keeps them out of the MongoDB response.

## Explicit Access

Use `.show()` only in the narrow service that needs the field:

```ts
const account = await db.user.find({ email: 'ada@example.com' }).show(['passwordHash']);
```

The returned type includes the shown field. Keep this operation close to authentication or another explicit security boundary.

## Hidden Fields and Selection

Selection and showing fields are separate concerns:

```ts
const account = await db.user.find({ _id: id }).select(['email']).show(['passwordHash']);
```

Use this sparingly. A safer pattern is to keep credential verification in a dedicated function that never returns the full account object.

## What Hidden Does Not Do

- It does not encrypt the value.
- It does not prevent direct access through the native MongoDB driver.
- It does not replace authorization.
- It does not remove the field from the database.

It is a safe default projection enforced by model queries.
