# Query API

Query builders are awaitable `PromiseLike` objects.

```ts
const users = await db.users
  .filter({ age: { $gte: 18 } })
  .sort({ age: 'desc' })
  .limit(10)
  .select(['name', 'age']);
```

Available methods include:

- `select(fields)`: include selected visible fields and `_id`.
- `show(fields)`: explicitly include hidden fields.
- `sort(spec)`: sort by schema fields.
- `skip(count)`: skip matching documents.
- `limit(count)`: limit result count.
- `populate(specs)`: perform explicit relation population.
- `with(name)`: apply a named scope.
- `count(estimate?)`: exact or estimated count.
- `cursor(after?)`: create a cursor page.

`find()` supports selection, showing hidden fields, population, and scopes. List-specific pagination and count methods belong to `filter()`.
