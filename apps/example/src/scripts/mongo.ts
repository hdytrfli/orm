import { faker } from '@faker-js/faker';

import { db } from '@/libs/database';
import { env } from '@/libs/env';
import { schema, userSchema } from '@/schemas';
import { log } from '@/utils/logger';

faker.seed(env.FAKER_SEED);

await db.connect();

try {
  await db.users.delete({});
  await db.groups.delete({});
  await db.companies.delete({});

  const company = await db.companies.create({
    name: 'Analytical Engines Ltd.',
    description: 'Computing research and engineering',
  });

  const group = await db.groups.create({
    name: 'Language',
  });

  const userData = {
    name: 'Ada Lovelace',
    age: 11,
    role: 'admin',
    password: 'ada-secret',
    group: group._id,
    company: company._id,
    profile: {
      email: 'ada@example.com',
      website: 'https://ada.example',
      location: {
        city: 'London',
        country: 'United Kingdom',
      },
    },
  };

  const validated = userSchema.parse(userData);
  log.debug({ context: 'validated', value: validated });

  const user = await db.users.create(validated);
  log.debug({ context: 'created', value: user });

  const another = await db.users.create({
    name: 'Alan Turing',
    age: 36,
    role: 'member',
    password: 'alan-secret',
    group: group._id,
    company: company._id,
    profile: {
      email: 'alan@example.com',
      website: 'https://alan.example',
      location: {
        city: 'London',
        country: 'United Kingdom',
      },
    },
  });

  await db.groups.update({ _id: group._id }, { creator: user._id });

  await Promise.all(
    Array.from({ length: 18 }, () => {
      return db.users.create({
        name: faker.person.fullName(),
        age: faker.number.int({ min: 18, max: 65 }),
        role: faker.helpers.arrayElement(['admin', 'member']),
        password: faker.internet.password(),
        group: group._id,
        company: company._id,
        profile: {
          email: faker.internet.email(),
          website: faker.internet.url(),
          location: {
            city: faker.location.city(),
            country: faker.location.country(),
          },
        },
      });
    }),
  );

  const found = await db.users
    .find({ _id: user._id })
    .select(['name', 'group', 'profile.location.city']);

  if (!found) throw new Error('User not found');

  log.debug({ context: 'city', value: found.profile.location.city });
  log.debug({ context: 'found', value: found });
  log.debug({
    context: 'populated',
    value: await db.users
      .find({ _id: user._id })
      .populate([{ ref: 'group', populate: [{ ref: 'creator' }] }])
      .all(),
  });

  log.debug({
    context: 'with detail',
    value: await db.users.find({ _id: user._id }).with('detail'),
  });

  log.debug({
    context: 'with hidden field',
    value: await db.users.find({ _id: user._id }).show(['password']),
  });

  log.debug({ context: 'filtered simple', value: await db.users.filter({ role: 'admin' }) });

  const filteredSorted = await db.users
    .filter({ $or: [{ role: 'admin' }, { age: { $gte: 18 } }] })
    .select(['name', 'age', 'deletedAt'])
    .sort({ age: 'asc' })
    .skip(1)
    .limit(3);

  log.debug({
    context: 'filtered sorted with skip',
    value: { count: filteredSorted.length, preview: filteredSorted.slice(0, 3) },
  });

  log.debug({
    context: 'filtered with or',
    value: await db.users.filter({ $or: [{ role: 'admin' }, { age: { $gte: 18 } }] }).limit(2),
  });

  log.debug({
    context: 'filtered with and',
    value: await db.users.filter({ $and: [{ role: 'member' }, { age: { $gte: 18 } }] }).limit(2),
  });

  log.debug({ context: 'exact count', value: await db.users.filter({ role: 'admin' }).count() });

  log.debug({
    context: 'estimated count',
    value: await db.users.filter().all().count(true),
  });

  const test = await db.users.filter().sort({ _id: 'asc' }).limit(6);
  log.debug({ context: 'test', value: test });

  let count = 0;

  const first = db.users.filter().limit(3).cursor();
  for await (const item of first)
    log.debug({ context: 'cursor item', value: { count: ++count, item } });

  const next = first.next ?? undefined;
  const second = db.users.filter().limit(3).cursor(next);
  for await (const item of second)
    log.debug({ context: 'cursor item', value: { count: ++count, item } });

  log.debug({ context: 'cursor pages', value: { next: second.next } });
  log.debug({
    context: 'updated',
    value: await db.users.update({ _id: user._id }, { role: 'admin', age: 20 }),
  });

  log.debug({
    context: 'deleted',
    value: await db.users.delete({ _id: { $in: [user._id, another._id] } }),
  });

  if (found) {
    const groupRelation = schema.users.relationMap.group;
    const relatedGroupModel = db.model('groups', groupRelation.resolve());

    log.debug({ context: 'relation path', value: 'group' });
    log.debug({ context: 'relation value', value: found.group });

    const relatedGroup = await relatedGroupModel.find({ _id: found.group });
    log.debug({ context: 'related group', value: relatedGroup });
  }
} finally {
  await db.disconnect();
}
