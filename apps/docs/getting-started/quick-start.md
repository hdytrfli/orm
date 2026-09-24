---
order: 2
---

# End-to-End Tutorial

This tutorial builds a small blog data layer. It walks through schemas, an active-only unique index, a relation and population scope, database setup, writes, nested filters, and soft-delete operations. The examples use only Mongorm's API and the MongoDB connection it owns.

You need a reachable MongoDB database and `@mongorm/orm` installed. Put the URI in `MONGODB_URI`; use a disposable database while following the tutorial.

## 1. Define the schemas

Start with a user. The schema validates email and name, keeps the password hash out of normal query results, and adds timestamps and soft deletes.

```ts
import { createDatabase, orm } from '@mongorm/orm';

const userSchema = orm
  .schema({
    email: orm.email(),
    name: orm.string().min(1),
    passwordHash: orm.string().hidden(),
    profile: orm.object({
      location: orm.object({
        city: orm.string(),
      }),
    }),
  })
  .options({ timestamps: true, softdelete: true, hideManaged: true })
  .indexes([
    {
      fields: { email: 1 },
      options: {
        name: 'active_user_email_unique',
        unique: true,
        partialFilterExpression: { deletedAt: null },
      },
    },
  ]);

const postSchema = orm
  .schema({
    title: orm.string().min(1),
    body: orm.string(),
    author: orm.objectId(),
    published: orm.boolean().default(false),
  })
  .options({ timestamps: true, softdelete: true, hideManaged: true })
  .indexes([
    { fields: { published: 1, createdAt: -1 }, options: { name: 'post_published_recent' } },
  ]);
```

`hideManaged` omits `createdAt`, `updatedAt`, and `deletedAt` from default query results; use `.show()` to include them. It does not change mutation results. `.hidden()` omits `passwordHash` from default query results, but does not hash or encrypt it.

The user email index applies only when `deletedAt` is `null`. A soft-deleted account releases its email for reuse. If deleted accounts should continue reserving email addresses, omit the partial filter. See [Schema Indexes](/schemas/indexes) before adapting this policy.

## 2. Register the relation and a reusable population scope

Register both schemas, then map the post's `author` ObjectId field to the `users` model. The local field name becomes the population `ref` name.

```ts
const schemas = orm
  .defineSchemas({ users: userSchema, posts: postSchema })
  .defineRelations({ posts: { author: 'users' } })
  .defineScopes({
    posts: {
      detail: [{ ref: 'author', select: ['name', 'email'] }],
    },
  });
```

Because the local field is named `author`, queries use `ref: 'author'`. If it were named `authorId`, its relation name would be `authorId`.

## 3. Create and connect the database

The registry keys become model properties. Connect before using a model, then synchronize declared indexes explicitly:

```ts
const db = createDatabase({
  uri: process.env.MONGODB_URI!,
  database: 'mongorm_tutorial',
  schema: schemas,
});

await db.connect();
const indexNames = await db.sync();
console.log(indexNames);
// For example: { users: ['active_user_email_unique'], posts: ['post_published_recent'] }
```

`db.sync()` creates declared indexes; it does not remove undeclared indexes or change existing index options. Keep this connection open while running the remaining steps. In application code, put database operations inside `try`/`finally` so `disconnect()` still runs if an operation fails. Unique index creation fails if existing records violate the constraint.

## 4. Create documents

Create the user first so its generated `_id` can be stored in the post's `author` field:

```ts
const ada = await db.users.create({
  email: 'ada@example.com',
  name: 'Ada Lovelace',
  passwordHash: 'replace-with-a-real-password-hash',
  profile: { location: { city: 'London' } },
});

const post = await db.posts.create({
  title: 'A typed document layer',
  body: 'MongoDB and TypeScript can work together.',
  author: ada._id,
});
```

`create()` validates input, applies schema defaults, generates `_id`, inserts the document, and returns the full created document. The returned user also contains managed fields even though `hideManaged` is enabled; that option applies to query projections.

The sample email is protected by a unique index. Use a fresh disposable database or change the email when running the tutorial again. Do not clear a shared database just to rerun an example.

## 5. Filter and select query results

`find()` resolves to an array. It supports MongoDB filters, sort, limits, selection, and population:

```ts
const posts = await db.posts
  .find({ published: true })
  .sort({ createdAt: 'desc' })
  .limit(10)
  .select(['title'])
  .with('detail');

const firstPost = posts[0];
if (firstPost) {
  firstPost.title; // string
  firstPost.author?.name; // string | undefined
  firstPost.createdAt; // TypeScript error: hidden by default
}
```

The query returns an array of selected posts; `_id` is retained automatically. The `detail` scope populates `author` with only `name` and `email`. A populated relation is nullable because the referenced document may not exist.

Use `.first()` when one result is needed:

```ts
const onePost = await db.posts.find({ _id: post._id }).with('detail').first();
// onePost is a populated post or null
```

## 6. Filter nested fields

Use MongoDB dot notation to match a nested value without requiring an exact match for the entire embedded object:

```ts
const LondonUsers = await db.users.find({ 'profile.location.city': 'London' });
```

The path and value are checked against the schema. For a whole embedded-document comparison, filter the parent field instead; that has MongoDB's embedded-document equality semantics.

## 7. Show a hidden field intentionally

When a query genuinely needs a hidden field, request it explicitly and keep the result narrowly scoped:

```ts
const userForPasswordVerification = await db.users
  .find({ _id: ada._id })
  .show(['passwordHash'])
  .first();

userForPasswordVerification?.passwordHash;
```

Do not log or return this result to a caller. Hidden fields are a default projection policy, not encryption or authorization.

## 8. Update and soft-delete

`update()` applies a validated partial `$set` to the first matching document. It returns the full updated document or `null`:

```ts
const updatedPost = await db.posts.update({ _id: post._id }, { published: true });
updatedPost?.createdAt; // managed field is present on mutation results
```

On a soft-delete schema, `delete()` marks matching active records by setting `deletedAt`; it does not physically remove them. Normal queries hide them, and `.restore()` can reactivate them:

```ts
await db.users.delete({ _id: ada._id });

const deletedAda = await db.users.find({ _id: ada._id }).deleted('only').first();
const restoredAda = await db.users.restore({ _id: ada._id });
```

`purge()` permanently removes matching records and is available on soft-delete models. Use it only when permanent removal is intended.

## Next steps

- Learn field composition in [Schema Fundamentals](/schemas/fundamentals).
- Review relation behavior and nested loading in [Relations](/schemas/relations) and [Population](/queries/population).
- Choose indexes in [Schema Indexes](/schemas/indexes).
- Explore filters and operators in [Query Fundamentals](/queries/fundamentals).

When the tutorial is complete, close the client:

```ts
await db.disconnect();
```
