import { createDatabase, orm } from '@mongorm/orm';

const db = createDatabase({
  uri: 'mongodb://root:example@127.0.0.1:27017',
  database: 'mongorm_example',
});

const groupSchema = orm.schema({
  name: orm.string(),
});

const userSchema = orm.schema({
  name: orm.string(),
  role: orm.enum(['admin', 'member']),
  group: orm.ref(() => groupSchema),
});

const groups = db.model('groups', groupSchema);
const users = db.model('users', userSchema);

await db.connect();

try {
  const group = await groups.create({ name: 'Language' });
  const created = await users.create({
    name: 'Ada Lovelace',
    role: 'admin',
    group: group._id,
  });

  console.log('created:', created);
  const found = await users.find({ _id: created._id });
  console.log('found:', found);
  console.log('filtered:', await users.filter({ role: 'admin' }));
  console.log('updated:', await users.update({ _id: created._id }, { role: 'member' }));
  console.log('deleted:', await users.delete({ _id: created._id }));
  if (found) {
    const groupRef = userSchema.refs.group;
    const relatedGroupModel = db.model('groups', groupRef.resolve());
    console.log('ref path:', 'group');
    console.log('ref value:', found.group);
    console.log('related group:', await relatedGroupModel.find({ _id: found.group }));
  }
  await groups.delete({ _id: group._id });
} finally {
  await db.disconnect();
}
