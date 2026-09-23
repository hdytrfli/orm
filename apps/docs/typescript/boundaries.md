---
order: 4
---

# Compiler and Runtime Boundaries

TypeScript and Zod protect different moments in the data lifecycle.

## TypeScript Catches Developer Mistakes

- Invalid schema field names in filters and sorting.
- Invalid selection paths.
- Invalid hidden fields passed to `.show()`.
- Unknown relation and scope names.
- Incorrect assumptions about populated result shape.

## Runtime Validation Catches External Data

TypeScript cannot validate JSON received over HTTP, queue messages, or data read from an untrusted source. Zod parsing does that at runtime.

```ts
const payload = user.parse(request.body);
await db.user.create(payload);
```

The model also validates its own mutation input. Keep that final boundary even if the route already parses the request.

## MongoDB Is Still Runtime Data

Existing collections may contain old or malformed documents. Schema validation on writes does not retroactively repair all existing records. Plan migrations and defensive reads when adopting Mongorm in an existing database.

## Avoid `as` to Silence Query Errors

If a selection or population expression does not type-check, fix the schema or query contract. Casting the result to a larger type can reintroduce the exact data exposure and nullability bugs the typed API is intended to prevent.
