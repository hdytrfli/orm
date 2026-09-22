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
  age: orm.number(),
  role: orm.enum(['admin', 'member']),
  group: orm.ref(() => groupSchema),
});

const groups = db.model('groups', groupSchema);
const users = db.model('users', userSchema);

await db.connect();

try {
  const group = await groups.create({ name: 'Language' });

  const userData = {
    name: 'Ada Lovelace',
    age: 11,
    role: 'admin',
    group: group._id,
  };

  const validated = userSchema.parse(userData);
  console.log('validated:', validated);

  const created = await users.create(validated);
  console.log('created:', created);

  const found = await users.find({ _id: created._id });
  console.log('found:', found);

  console.log(
    'filtered:',
    await users.filter({
      role: { $in: ['admin'] },
      age: { $lte: 20 },
    }),
  );

  console.log('updated:', await users.update({ _id: created._id }, { role: 'admin', age: 20 }));
  console.log('deleted:', await users.delete({ _id: created._id }));

  if (found) {
    const groupRef = userSchema.refs.group;
    const relatedGroupModel = db.model('groups', groupRef.resolve());

    console.log('ref path:', 'group');
    console.log('ref value:', found.group);

    const relatedGroup = await relatedGroupModel.find({ _id: found.group });
    console.log('related group:', relatedGroup);
  }

  await groups.delete({
    _id: group._id,
  });
} finally {
  await db.disconnect();
}
