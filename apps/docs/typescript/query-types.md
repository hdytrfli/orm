---
order: 2
---

# Typed Query Composition

Query methods are designed to transform the result type as the query changes.

## Selection Narrows

```ts
const users = await db.user.find({ active: true }).select(['name', 'email']);

const first = users[0];
first.name;
first.email;
// first.age; // compile-time error
```

The selection list is checked against schema keys. Misspelled fields fail during development rather than becoming silently empty projections.

## Nested Selection Preserves Shape

```ts
const users = await db.user.find().select(['name', 'profile.avatarUrl']);

users[0].profile.avatarUrl;
```

The path is represented as a nested object in the result type.

## Population Adds Relations

```ts
const posts = await db.post.find({}).populate([{ ref: 'author', select: ['name'] }]);

posts[0].author?.name;
```

The relation name must be declared in the registry. The populated value is nullable because a foreign key may not resolve to a document.

## Nested Population Is Recursive

```ts
const posts = await db.post.find({}).populate([
  {
    ref: 'author',
    populate: [{ ref: 'team', select: ['name'] }],
  },
]);

posts[0].author?.team?.name;
```

The compiler follows the relation graph and rejects a nested relation that does not exist on the target schema.

## Scope Names Are Checked

```ts
await db.post.find({}).with('detail');
// await db.post.find({}).with('typo'); // compile-time error
```

## Query Builders Are Not Mutable Types

Methods return the appropriately typed builder, even though the runtime builder can update its internal operation state. Assign the result when it helps preserve the intended type:

```ts
const selected = db.user.find().select(['email']);
const users = await selected;
```
