---
order: 4
---
# Testing

Test schema rules, service intent, and database behavior at different levels.

## Schema Tests

Test required fields, invalid values, defaults, and hidden-field declarations without needing MongoDB:

```ts
expect(() => user.parse({ email: 'invalid' })).toThrow();
expect(user.parse({ email: 'ada@example.com' }).name).toBeUndefined();
```

## Service Tests

Use a test database for behavior that depends on filters, projections, relations, or update semantics. Assertions should inspect the returned shape, not only the number of calls made by a mock.

## Integration Tests

Run MongoDB-backed tests against an isolated database or container. Verify:

- Documents are validated before insertion.
- Hidden fields are absent from default results.
- Nested selections retain the expected object shape.
- Population returns `null` for missing targets.
- Cursor continuation does not duplicate documents.
- Exact and estimated count constraints are enforced.

## Test Destructive Operations

Use unique test identifiers and clean up in `afterEach` or an isolated database. Never point a test suite at a shared development database.
