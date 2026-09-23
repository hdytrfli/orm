# Pagination and Counts

## Cursor Pagination

Cursor pagination uses ascending `_id` order and a positive limit:

```ts
const firstPage = db.users.filter().limit(25).cursor();
const firstUsers = await Array.fromAsync(firstPage);

const secondPage = db.users
  .filter()
  .limit(25)
  .cursor(firstPage.next ?? undefined);

const nextUsers = await Array.fromAsync(secondPage);
```

`cursor()` returns one page. Reusing the same cursor replays that page; it does not advance it automatically. Use its `next` ObjectId to create the next page.

Do not compare a cursor query with an unsorted query. Normal MongoDB queries have no guaranteed natural order. If comparing results, sort the normal query by `_id: 'asc'`.

Cursor queries do not support arbitrary sorting or `skip()`. These restrictions protect cursor continuity.

## Exact Counts

Call `count()` for an exact count, including filtered counts:

```ts
const admins = await db.users.filter({ role: 'admin' }).count();
```

## Estimated Counts

Pass `true` to use MongoDB’s collection estimate:

```ts
const approximateTotal = await db.users.filter().count(true);
```

Estimated counts cannot apply filters:

```ts
await db.users.filter({ role: 'admin' }).count(true); // rejects at runtime
```

Use estimated counts for dashboards or rough capacity information, not authorization or billing decisions.
