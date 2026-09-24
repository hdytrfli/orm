import { faker } from '@faker-js/faker';

import { db } from '@/libs/database';
import { env } from '@/libs/env';
import { schema, userSchema } from '@/schemas';
import { log } from '@/utils/logger';

faker.seed(env.FAKER_SEED);

await db.connect();

log.info({
  context: 'database',
  value: 'database connection established',
});

await db.sync({
  dropIndexes: true,
});

log.info({
  context: 'database',
  value: 'database indexes reset',
});

try {
  await db.users.delete({
    //
  });

  await db.tasks.delete({
    //
  });

  await db.groups.delete({
    //
  });

  await db.projects.delete({
    //
  });

  await db.companies.delete({
    //
  });

  const company = await db.companies.create({
    slug: 'analytical-engines',
    name: 'Analytical Engines Ltd.',
    domain: 'team@analytical-engines.example',
    description: 'Computing research and engineering',
    plan: 'growth',
    settings: { timezone: 'Europe/London', weeklyDigest: true, maxMembers: 250 },
  });

  const group = await db.groups.create({
    company: company._id,
    name: 'Language',
    description: 'Language and compiler research',
    permissions: { canInvite: true, canManageBilling: false, canExportData: true },
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
  log.debug({
    context: 'validated',
    value: validated,
  });

  const user = await db.users.create(validated);
  log.debug({
    context: 'created',
    value: user,
  });

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

  const project = await db.projects.create({
    company: company._id,
    owner: user._id,
    key: 'COMPILER',
    name: 'Compiler research',
    description: 'Experiments in automatic computing and language design',
    status: 'active',
    visibility: 'company',
    repository: 'https://github.com/example/compiler-research',
    metadata: {
      color: '#b387e8',
      tags: ['research', 'language'],
    },
  });

  const task = await db.tasks.create({
    project: project._id,
    createdBy: user._id,
    assignee: another._id,
    title: 'Document the instruction set',
    description: 'Capture the instruction set and examples for the research team.',
    status: 'in_progress',
    priority: 'high',
    labels: ['documentation', 'architecture'],
    dueAt: new Date('2026-12-01T00:00:00.000Z'),
    estimateHours: 12,
    audit: {
      source: 'manual',
    },
  });

  log.debug({
    context: 'project',
    value: await db.projects.find({ _id: project._id }).with('detail').first(),
  });
  log.debug({
    context: 'task',
    value: await db.tasks.find({ _id: task._id }).with('detail').first(),
  });

  await db.users.bulk.create(
    Array.from({ length: 18 }, () => ({
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
    })),
  );

  const found = await db.users
    .find({ _id: user._id })
    .select(['name', 'group', 'profile.location.city'])
    .first();

  if (!found) throw new Error('User not found');

  log.debug({
    context: 'found',
    value: found,
  });

  log.debug({
    context: 'city',
    value: found.profile.location.city,
  });

  log.debug({
    context: 'populated',
    value: await db.users
      .find({ _id: user._id })
      .populate([{ ref: 'group', populate: [{ ref: 'creator' }] }])
      .deleted('include')
      .first(),
  });

  log.debug({
    context: 'with detail',
    value: await db.users.find({ _id: user._id }).with('detail').first(),
  });

  log.debug({
    context: 'with hidden field',
    value: await db.users.find({ _id: user._id }).show(['password']).first(),
  });

  log.debug({
    context: 'filtered simple',
    value: await db.users.find({ role: 'admin' }),
  });

  const filteredSorted = await db.users
    .find({ $or: [{ role: 'admin' }, { age: { $gte: 18 } }] })
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
    value: await db.users.find({ $or: [{ role: 'admin' }, { age: { $gte: 18 } }] }).limit(2),
  });

  log.debug({
    context: 'filtered with and',
    value: await db.users.find({ $and: [{ role: 'member' }, { age: { $gte: 18 } }] }).limit(2),
  });

  log.debug({ context: 'exact count', value: await db.users.find({ role: 'admin' }).count() });

  log.debug({
    context: 'estimated count',
    value: await db.users.find().deleted('include').count(true),
  });

  const test = await db.users.find().sort({ _id: 'asc' }).limit(6);
  log.debug({ context: 'test', value: test });

  let count = 0;
  const first = db.users.find().limit(3).cursor();
  for await (const item of first) {
    log.debug({
      context: 'cursor item',
      value: { count: ++count, item },
    });
  }

  const next = first.next ?? undefined;
  const second = db.users.find().limit(3).cursor(next);
  for await (const item of second) {
    log.debug({
      context: 'cursor item',
      value: { count: ++count, item },
    });
  }

  log.debug({
    context: 'cursor pages',
    value: { next: second.next },
  });

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

    const relatedGroup = await relatedGroupModel.find({ _id: found.group }).first();
    log.debug({ context: 'related group', value: relatedGroup });
  }
} finally {
  await db.disconnect();
}
