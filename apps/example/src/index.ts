import { ObjectId, orm, type Infer } from '@mongorm/orm';

const groupSchema = orm.schema({
  name: orm.string(),
});

const userSchema = orm.schema({
  name: orm.string(),
  age: orm.number(),
  role: orm.enum(['admin', 'member']),
  group: orm.objectId().optional(),
});

const relatedUserSchema = userSchema.relations({
  group: () => groupSchema,
});

type User = Infer<typeof userSchema>;

const user: User = {
  _id: new ObjectId(),
  group: new ObjectId(),
  age: 36,
  role: 'admin',
  name: 'Ada Lovelace',
};

console.log('parsed user:', userSchema.parse(user));
console.log('relation target:', relatedUserSchema.relationMap.group.resolve() === groupSchema);

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
