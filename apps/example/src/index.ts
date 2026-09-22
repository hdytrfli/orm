import { ObjectId, orm, type Infer } from '@mongorm/orm';

const groupSchema = orm.schema({
  name: orm.string(),
});

const userSchema = orm.schema({
  name: orm.string(),
  age: orm.number(),
  role: orm.enum(['admin', 'member']),
  group: orm.ref(() => groupSchema),
});

type User = Infer<typeof userSchema>;

const user: User = {
  name: 'Ada Lovelace',
  age: 36,
  role: 'admin',
  group: new ObjectId(),
};

console.log('parsed user:', userSchema.parse(user));
console.log('relation target:', userSchema.refs.group.resolve() === groupSchema);

try {
  userSchema.parse({
    name: 'Not valid',
    age: 36,
    role: 'admin',
    group: new ObjectId(),
  });
} catch (error) {
  console.log('validation error:', error instanceof Error ? error.message : error);
}
