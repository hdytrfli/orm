# Population

Populate declared relations with explicit specs:

```ts
const user = await db.users.find({ _id: userId }).populate([
  {
    ref: 'group',
    select: ['name'],
  },
]);
```

The result type replaces `group: ObjectId` with `group: Group | null`.

## Nested Population

Population is recursive and can follow any finite relation path:

```ts
const user = await db.users.find({ _id: userId }).populate([
  {
    ref: 'group',
    populate: [
      {
        ref: 'creator',
        populate: [
          { ref: 'company' },
        ],
      },
    ],
  },
]);
```

The TypeScript result follows the same nesting:

```ts
if (user?.group?.creator?.company) {
  user.group.creator.company.name;
}
```

If a nested relation is needed for population, Mongorm automatically includes its local ObjectId in the internal projection even if it is omitted from `select`.

## Nullability

A missing related document is represented as `null`. Always handle that possibility at boundaries:

```ts
if (!user?.group) {
  throw new Error('Group not found');
}
```

## Scope Versus Explicit Population

Use `.populate()` for a one-off shape. Use `.with()` for a named, reusable shape. They are mutually exclusive.
