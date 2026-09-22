import { orm, type Infer } from '@mongorm/orm';

const userSchema = orm.schema({
  name: orm.string(),
  age: orm.number(),
  role: orm.enum(['admin', 'member']),
});

type User = Infer<typeof userSchema>;

const user: User = {
  name: 'Ada Lovelace',
  age: 36,
  role: 'admin',
};

console.log('parsed user:', userSchema.parse(user));

try {
  userSchema.parse({
    name: 'Not valid',
    age: 'thirty-six',
    role: 'admin',
  });
} catch (error) {
  console.log('validation error:', error instanceof Error ? error.message : error);
}
