import { createDatabase, orm } from '@mongorm/orm';

const db = createDatabase({
  uri: 'mongodb://root:example@127.0.0.1:27017',
  database: 'mongorm_example',
});

const userSchema = orm.schema({
  name: orm.string(),
  role: orm.enum(['admin', 'member']),
});

const users = db.model('users', userSchema);

await db.connect();

try {
  const created = await users.create({
    name: 'Ada Lovelace',
    role: 'admin',
  });

  console.log('created:', created);
  console.log('found:', await users.find({ _id: created._id }));
  console.log('filtered:', await users.filter({ role: 'admin' }));
  console.log('updated:', await users.update({ _id: created._id }, { role: 'member' }));
  console.log('deleted:', await users.delete({ _id: created._id }));
} finally {
  await db.disconnect();
}
