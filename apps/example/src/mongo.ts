import { faker } from '@faker-js/faker';
import { createDatabase } from '@mongorm/orm';

import { schema, userSchema } from './schema/index.js';

faker.seed(20260922);

const db = createDatabase({
  uri: 'mongodb://root:example@127.0.0.1:27017',
  database: 'mongorm_example',
  schema,
});

const { companies, groups, users } = db;

await db.connect();

try {
  await users.delete({});
  await groups.delete({});
  await companies.delete({});

  const company = await companies.create({
    name: 'Analytical Engines Ltd.',
    description: 'Computing research and engineering',
  });
  const group = await groups.create({ name: 'Language' });

  const userData = {
    name: 'Ada Lovelace',
    age: 11,
    role: 'admin',
    password: 'ada-secret',
    group: group._id,
    company: company._id,
  };

  const validated = userSchema.parse(userData);
  console.log('validated:', validated);

  const user = await users.create(validated);
  console.log('created:', user);

  const another = await users.create({
    name: 'Alan Turing',
    age: 36,
    role: 'member',
    password: 'alan-secret',
    group: group._id,
    company: company._id,
  });
  await groups.update({ _id: group._id }, { creator: user._id });

  await Promise.all(
    Array.from({ length: 18 }, () =>
      users.create({
        name: faker.person.fullName(),
        age: faker.number.int({ min: 18, max: 65 }),
        role: faker.helpers.arrayElement(['admin', 'member'] as const),
        password: faker.internet.password(),
        group: group._id,
        company: company._id,
      }),
    ),
  );

  const found = await users.find({ _id: user._id }).select(['name', 'group']);
  console.log('found:', found);
  console.log(
    'populated:',
    await users.find({ _id: user._id }).populate([
      {
        ref: 'group',
        select: ['name'],
        populate: [
          {
            ref: 'creator',
          },
        ],
      },
    ]),
  );
  console.log('with detail:', await users.find({ _id: user._id }).with('detail'));
  console.log('with hidden field:', await users.find({ _id: user._id }).show(['password']));

  console.log(
    'filtered simple:',
    await users.filter({
      role: 'admin',
    }),
  );

  const filteredSorted = await users
    .filter({
      $or: [
        // one of the following conditions must be true
        { role: 'admin' },
        { age: { $gte: 18 } },
      ],
    })
    .select(['name', 'age'])
    .sort({ age: 'asc' })
    .skip(1)
    .limit(3);

  console.log('filtered sorted with skip:', {
    count: filteredSorted.length,
    preview: filteredSorted.slice(0, 3),
  });

  console.log(
    'filtered with or:',
    await users
      .filter({
        $or: [
          // one of the following conditions must be true
          { role: 'admin' },
          { age: { $gte: 18 } },
        ],
      })
      .limit(2),
  );

  console.log(
    'filtered with and:',
    await users
      .filter({
        $and: [
          // both of the following conditions must be true
          { role: 'member' },
          { age: { $gte: 18 } },
        ],
      })
      .limit(2),
  );

  const first = users.filter().limit(3).cursor();
  const array = await Array.fromAsync(first);
  console.log('result array:', array);

  let count = 0;
  for await (const item of first) console.log({ count: ++count, item });

  const second = users
    .filter()
    .limit(3)
    .cursor(first.next ?? undefined);

  // const secondResults = [];
  count = 0;
  for await (const item of second) console.log({ count: ++count, item });

  console.log('cursor pages:', {
    next: second.next,
  });

  console.log('updated:', await users.update({ _id: user._id }, { role: 'admin', age: 20 }));
  console.log('deleted:', await users.delete({ _id: { $in: [user._id, another._id] } }));

  if (found) {
    const groupRelation = schema.users.relationMap.group;
    const relatedGroupModel = db.model('groups', groupRelation.resolve());

    console.log('relation path:', 'group');
    console.log('relation value:', found.group);

    const relatedGroup = await relatedGroupModel.find({ _id: found.group });
    console.log('related group:', relatedGroup);
  }

  await groups.delete({
    _id: group._id,
  });

  await users.delete({
    // this will delete all users
  });
} finally {
  await db.disconnect();
}
