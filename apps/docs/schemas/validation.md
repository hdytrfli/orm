---
order: 6
---

# Validation and Errors

Validation happens at the boundary where application data becomes a stored document. This prevents invalid input from silently becoming database state.

## Create Validation

```ts
await db.user.create({
  email: 'not-an-email',
  name: 'Ada',
});
```

This rejects before insertion because `email` does not satisfy the schema.

## Partial Update Validation

Updates are partial, but supplied fields are still parsed:

```ts
await db.user.update({ _id: userId }, { email: 'ada@example.com' });
```

Fields omitted from the patch are not required. Fields present in the patch must satisfy their schema validators.

## Validation Versus Database Errors

Validation errors indicate malformed application input. MongoDB errors may indicate duplicate indexes, connectivity failures, write conflicts, or server-side constraints. Handle them separately so clients receive useful and safe responses.

## Request Parsing

You may parse a request before calling a service:

```ts
const input = user.parse(request.body);
const created = await db.user.create(input);
```

This can produce better transport-level error messages, while `create()` remains the final invariant boundary.
