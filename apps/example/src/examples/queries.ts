import { db } from '@/libs/database';
import { log } from '@/utils/logger';

export const demonstrateQueries = async () => {
  // This module owns its sample tenant and documents; it does not rely on another demo.
  const company = await db.companies.create({
    slug: 'query-lab',
    name: 'Query Lab',
    domain: 'queries@example.test',
    plan: 'growth',
    settings: { timezone: 'UTC', weeklyDigest: true, maxMembers: 40 },
  });

  const group = await db.groups.create({
    company: company._id,
    name: 'Search Platform',
    description: 'Owns search and discovery.',
    permissions: { canInvite: true, canManageBilling: false, canExportData: true },
  });

  const user = await db.users.create({
    name: 'Maya Chen',
    username: 'maya-chen',
    age: 32,
    role: 'admin',
    password: 'query-demo-secret',
    group: group._id,
    company: company._id,
    profile: {
      email: 'maya@example.test',
      website: 'https://maya.example.test',
      location: { city: 'Seattle', country: 'United States' },
    },
  });

  const member = await db.users.create({
    name: 'Jordan Lee',
    age: 27,
    role: 'member',
    password: 'member-demo-secret',
    group: group._id,
    company: company._id,
    profile: {
      email: 'jordan@example.test',
      website: 'https://jordan.example.test',
      location: { city: 'Portland', country: 'United States' },
    },
  });

  const project = await db.projects.create({
    company: company._id,
    owner: user._id,
    key: 'SEARCH',
    name: 'Search improvements',
    status: 'active',
    visibility: 'company',
    metadata: { color: '#336699', tags: ['search'] },
  });

  await db.tasks.bulk.create([
    {
      project: project._id,
      createdBy: user._id,
      assignee: member._id,
      title: 'Tune ranking signals',
      status: 'in_progress',
      priority: 'high',
      labels: ['search', 'ranking'],
      dueAt: new Date('2026-10-15T00:00:00.000Z'),
      estimateHours: 8,
      audit: { source: 'manual' },
    },
    {
      project: project._id,
      createdBy: user._id,
      title: 'Review search analytics',
      status: 'todo',
      priority: 'normal',
      labels: ['analytics'],
      dueAt: null,
      estimateHours: 3,
      audit: { source: 'import', externalId: 'SEARCH-42' },
    },
  ]);

  const selected = await db.users
    .find({ _id: user._id })
    .select(['name', 'group', 'profile.location.city'])
    .first();
  if (!selected) throw new Error('Fixture user not found');

  log.info({
    context: 'selected user',
    value: selected,
  });

  log.info({
    context: 'nested selected city',
    value: selected.profile.location.city,
  });

  log.info({
    context: 'hidden password shown explicitly',
    value: await db.users.find({ _id: user._id }).show(['password']).first(),
  });

  log.info({
    context: 'nested filter',
    value: await db.users
      .find({ 'profile.location.city': 'Seattle' })
      .select(['name', 'profile.location.city']),
  });

  // Tenant-scoped read: always include the owning company in a multi-tenant query.

  log.info({
    context: 'company member directory',
    value: await db.users
      .find({ company: company._id, group: group._id })
      .select(['name', 'role', 'profile.location.city'])
      .sort({ name: 'asc' }),
  });

  // Search-style filters often combine exact matches and ranges.

  log.info({
    context: 'adult administrators',
    value: await db.users
      .find({ company: company._id, role: 'admin', age: { $gte: 18, $lte: 60 } })
      .select(['name', 'age', 'role']),
  });

  // `$in` is useful for compact dashboard tabs and multi-state queues.

  log.info({
    context: 'team task queue',
    value: await db.tasks
      .find({ project: { $exists: true }, status: { $in: ['todo', 'in_progress'] } })
      .sort({ priority: 'desc', dueAt: 'asc' })
      .limit(5),
  });

  // Exclude a noisy state while still retaining an explicit, tenant-scoped query.

  log.info({
    context: 'unfinished tasks excluding backlog',
    value: await db.tasks
      .find({ status: { $nin: ['backlog', 'done'] } })
      .select(['title', 'status', 'priority', 'dueAt']),
  });

  const page = await db.users
    .find({ $or: [{ role: 'admin' }, { age: { $gte: 18 } }] })
    .select(['name', 'age'])
    .show(['deletedAt'])
    .sort({ age: 'asc' })
    .skip(1)
    .limit(3);

  log.info({
    context: 'filtered, sorted page',
    value: { count: page.length, preview: page },
  });

  log.info({
    context: 'logical and filter',
    value: await db.users
      .find({
        $and: [
          {
            role: 'member',
          },
          {
            age: {
              $gte: 18,
            },
          },
        ],
      })
      .limit(2),
  });

  log.info({
    context: 'missing optional usernames',
    value: await db.users
      .find({ username: { $exists: false } })
      .select(['name', 'role'])
      .limit(5),
  });

  log.info({
    context: 'hidden fields stay hidden by default',
    value: await db.users.find({ _id: user._id }).first(),
  });

  log.info({
    context: 'valid query with no matches',
    value: await db.users.find({ company: company._id, age: { $gt: 120 } }),
  });

  log.info({
    context: 'count of an empty result set',
    value: await db.users.find({ company: company._id, role: 'member', age: { $lt: 0 } }).count(),
  });

  log.info({
    context: 'exact count',
    value: await db.users.find({ role: 'admin' }).count(),
  });

  log.info({
    context: 'estimated count including deleted',
    value: await db.users.find().deleted('include').count(true),
  });
};
