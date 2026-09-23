# Schemas and Zod

`orm` exposes the lowercase Zod constructors while adding Mongorm-specific `schema`, `defineSchemas`, `objectId`, and `ref` helpers.

```ts
const userSchema = orm.schema({
  name: orm.string().min(2),
  email: orm.email(),
  website: orm.url().optional(),
  tags: orm.array(orm.string()),
  role: orm.enum(['admin', 'member']),
});
```

Because these are native Zod schemas, normal Zod methods are available:

```ts
orm.string().trim().toLowerCase().min(3);
orm.number().int().positive();
orm.array(orm.email()).min(1);
orm.union([orm.string(), orm.number()]);
orm.record(orm.string(), orm.string());
```

## Nested Objects

```ts
const profile = orm.object({
  email: orm.email(),
  website: orm.url().optional(),
  location: orm.object({
    city: orm.string(),
    country: orm.string(),
  }),
});

const userSchema = orm.schema({
  name: orm.string(),
  profile: profile.optional(),
});
```

Nested data is parsed by Zod and inferred by TypeScript. Nested paths can be selected with dot notation, such as `profile.location.city`.

## Parsing

```ts
const parsed = userSchema.parse(input);
const result = userSchema.safeParse(input);
const partial = userSchema.parsePartial({ name: 'Grace Hopper' });
```

`parse()` throws a Zod error for invalid input. `safeParse()` returns a success/error result. `parsePartial()` is intended for update payloads.

## Hidden Fields

Hidden fields are still validated and stored. They are only omitted from default query projections.

```ts
const accountSchema = orm.schema({
  email: orm.email(),
  password: orm.string().min(12).hidden(),
});
```

Expose a hidden field deliberately with `show()`:

```ts
const account = await db.accounts.find({}).show(['password']);
```

Best practice: keep secrets hidden by default and use `show()` only in a narrowly scoped authentication or administration path.
