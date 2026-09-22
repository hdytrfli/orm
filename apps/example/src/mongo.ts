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

  const user = await users.create(validated);
  console.log('created:', user);

  const another = await users.create({
    name: 'Alan Turing',
    age: 36,
    role: 'member',
    group: group._id,
  });

  const found = await users.find({ _id: user._id });
  console.log('found:', found);

  console.log(
    'filtered simple:',
    await users.filter({
      role: 'admin',
    }),
  );

  console.log(
    'filtered with or:',
    await users.filter({
      $or: [
        // one of the following conditions must be true
        { role: 'admin' },
        { age: { $gte: 18 } },
      ],
    }),
  );

  console.log(
    'filtered with and:',
    await users.filter({
      $and: [
        // both of the following conditions must be true
        { role: 'member' },
        { age: { $gte: 18 } },
      ],
    }),
  );

  console.log('updated:', await users.update({ _id: user._id }, { role: 'admin', age: 20 }));
  console.log('deleted:', await users.delete({ _id: { $in: [user._id, another._id] } }));

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
