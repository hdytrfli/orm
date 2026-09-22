import { ObjectId, orm, type Infer } from '@mongorm/orm';

const groupSchema = orm.schema({
  name: orm.string(),
});

const userSchema = orm.schema({
  name: orm.string(),
  age: orm.number(),
  role: orm.enum(['admin', 'member']),
  group: orm.ref(() => groupSchema).optional(),
});

type User = Infer<typeof userSchema>;

const user: User = {
  _id: new ObjectId(),
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
    group: 'not-an-object-id',
  });
} catch (error) {
  console.log('validation error:', error instanceof Error ? error.message : error);
}
