import { db } from '@/libs/database';
import { schemas } from '@/schemas';
import { log } from '@/utils/logger';

export const demonstrateRelations = async () => {
  const company = await db.companies.create({
    slug: 'relation-lab',
    name: 'Relation Lab',
    plan: 'enterprise',
    settings: { timezone: 'Europe/Paris', weeklyDigest: true, maxMembers: 120 },
  });

  const group = await db.groups.create({
    company: company._id,
    name: 'Data Platform',
    description: 'Builds internal data products.',
    permissions: { canInvite: true, canManageBilling: true, canExportData: true },
  });

  const user = await db.users.create({
    name: 'Nina Patel',
    age: 38,
    role: 'admin',
    password: 'relation-demo-secret',
    group: group._id,
    company: company._id,
    profile: {
      email: 'nina@example.test',
      website: 'https://nina.example.test',
      location: { city: 'Paris', country: 'France' },
    },
  });

  await db.groups.update({ _id: group._id }, { creator: user._id });

  const anotherUser = await db.users.create({
    name: 'Elliot Park',
    age: 31,
    role: 'member',
    password: 'relation-member-secret',
    group: group._id,
    company: company._id,
    profile: {
      email: 'elliot@example.test',
      website: 'https://elliot.example.test',
      location: { city: 'Lyon', country: 'France' },
    },
  });

  const project = await db.projects.create({
    company: company._id,
    owner: user._id,
    key: 'DATAOPS',
    name: 'Data operations',
    status: 'active',
    visibility: 'company',
    metadata: { color: '#7962a8', tags: ['data', 'operations'] },
  });

  const task = await db.tasks.create({
    project: project._id,
    createdBy: user._id,
    assignee: anotherUser._id,
    title: 'Validate warehouse freshness',
    status: 'todo',
    priority: 'high',
    labels: ['warehouse'],
    dueAt: null,
    estimateHours: 6,
    audit: { source: 'manual' },
  });

  log.info({
    context: 'user relation population',
    value: await db.users
      .find({ _id: user._id })
      .populate([{ ref: 'group', populate: [{ ref: 'creator' }] }])
      .deleted('include')
      .first(),
  });

  log.info({
    context: 'user detail scope',
    value: await db.users.find({ _id: user._id }).with('detail').first(),
  });

  log.info({
    context: 'task detail scope',
    value: await db.tasks.find({ _id: task._id }).with('detail').first(),
  });

  log.info({
    context: 'project detail scope',
    value: await db.projects.find({ _id: project._id }).with('detail').first(),
  });

  // Populate only the relations needed for a compact task-list response.

  log.info({
    context: 'task list with selected relations',
    value: await db.tasks
      .find({ assignee: anotherUser._id })
      .populate([
        { ref: 'project', select: ['key', 'name'] },
        { ref: 'assignee', select: ['name'] },
      ])
      .select(['title', 'status', 'priority', 'project', 'assignee']),
  });

  // A nested populate resolves the person who created the task's project.

  log.info({
    context: 'project owner and company context',
    value: await db.projects
      .find({ _id: project._id })
      .populate([{ ref: 'owner' }, { ref: 'company' }])
      .first(),
  });

  // Populate from the task's assignee to their group and group creator.

  log.info({
    context: 'assignee team hierarchy',
    value: await db.tasks
      .find({ _id: task._id })
      .populate([{ ref: 'assignee', populate: [{ ref: 'group', populate: [{ ref: 'creator' }] }] }])
      .first(),
  });

  const selected = await db.users.find({ _id: user._id }).select(['name', 'group']).first();
  if (!selected) throw new Error('Fixture user not found');

  const groupModel = db.model('groups', schemas.users.relationMap.group.resolve());

  log.info({
    context: 'relation id',
    value: selected.group,
  });

  log.info({
    context: 'related group queried with its relation schema',
    value: await groupModel.find({ _id: selected.group }).first(),
  });

  log.info({
    context: 'relation query with no matching user',
    value: await db.users
      .find({ name: 'Nobody in this demo' })
      .populate([{ ref: 'group' }])
      .first(),
  });
};
