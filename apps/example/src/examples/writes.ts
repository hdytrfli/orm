import { db } from '@/libs/database';
import { log } from '@/utils/logger';

export const demonstrateWrites = async () => {
  const company = await db.companies.create({
    slug: 'write-lab',
    name: 'Write Lab',
    plan: 'starter',
    settings: {
      timezone: 'America/New_York',
      weeklyDigest: false,
      maxMembers: 25,
    },
  });

  const group = await db.groups.create({
    company: company._id,
    name: 'Release Engineering',
    permissions: {
      canInvite: true,
      canManageBilling: false,
      canExportData: false,
    },
  });

  const user = await db.users.create({
    name: 'Sam Rivera',
    age: 34,
    role: 'admin',
    password: 'write-demo-secret',
    group: group._id,
    company: company._id,
    profile: {
      email: 'sam@example.test',
      website: 'https://sam.example.test',
      location: {
        city: 'New York',
        country: 'United States',
      },
    },
  });

  const anotherUser = await db.users.create({
    name: 'Alex Morgan',
    age: 29,
    role: 'member',
    password: 'member-write-secret',
    group: group._id,
    company: company._id,
    profile: {
      email: 'alex@example.test',
      website: 'https://alex.example.test',
      location: {
        city: 'Boston',
        country: 'United States',
      },
    },
  });

  const project = await db.projects.create({
    company: company._id,
    owner: user._id,
    key: 'RELEASES',
    name: 'Release automation',
    status: 'active',
    visibility: 'company',
    metadata: {
      color: '#4b6b50',
      tags: ['delivery'],
    },
  });

  const task = await db.tasks.create({
    project: project._id,
    createdBy: user._id,
    assignee: anotherUser._id,
    title: 'Prepare release checklist',
    status: 'in_progress',
    priority: 'high',
    labels: ['release'],
    dueAt: new Date('2026-11-01T00:00:00.000Z'),
    estimateHours: 4,
    audit: {
      source: 'manual',
    },
  });

  const inserted = await db.groups.upsert(
    { company: company._id, name: 'Upsert demo' },
    {
      description: 'Created by upsert',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: false,
      },
    },
  );

  const updated = await db.groups.upsert(
    { company: company._id, name: 'Upsert demo' },
    {
      description: 'Updated by upsert',
      permissions: {
        canInvite: true,
        canManageBilling: false,
        canExportData: false,
      },
    },
  );

  log.info({
    context: 'upsert insert and update',
    value: {
      inserted,
      updated,
    },
  });

  // Idempotent provisioning: rerunning the same upsert updates the matching active record.

  const provisionedGroup = await db.groups.upsert(
    { company: company._id, name: 'Customer Success' },
    {
      description: 'Coordinates customer onboarding and support.',
      permissions: {
        canInvite: true,
        canManageBilling: false,
        canExportData: false,
      },
    },
  );

  log.info({ context: 'idempotently provisioned team', value: provisionedGroup });

  // Append realistic imported work in one validated bulk insert.

  const importedTasks = await db.tasks.bulk.create([
    {
      project: project._id,
      createdBy: user._id,
      assignee: anotherUser._id,
      title: 'Reconcile customer feedback',
      description: 'Import and deduplicate feedback from the support queue.',
      status: 'todo',
      priority: 'normal',
      labels: ['customer-feedback', 'imported'],
      dueAt: null,
      estimateHours: 3,
      audit: {
        source: 'import',
        externalId: 'SUPPORT-902',
      },
    },
    {
      project: project._id,
      createdBy: user._id,
      title: 'Publish release notes',
      status: 'backlog',
      priority: 'low',
      labels: ['release'],
      dueAt: null,
      estimateHours: 1,
      audit: {
        source: 'automation',
        externalId: 'release-notes-job',
      },
    },
  ]);

  log.info({ context: 'bulk imported tasks', value: importedTasks });

  // Typical workflow transition and reassignment.

  const movedToReview = await db.tasks.update(
    { _id: task._id, status: 'in_progress' },
    { status: 'blocked', priority: 'urgent' },
  );

  const reassigned = await db.tasks.update(
    { _id: task._id },
    { assignee: user._id, status: 'todo', priority: 'high' },
  );

  log.info({
    context: 'task transition and reassignment',
    value: {
      movedToReview,
      reassigned,
    },
  });

  const unmatchedUpdate = await db.tasks.update(
    { project: project._id, title: 'Task that does not exist' },
    { status: 'done' },
  );

  log.info({ context: 'update with no matching document', value: unmatchedUpdate });

  // Restore a soft-deleted team without recreating its identity or history.

  await db.groups.delete({ _id: group._id });

  const archivedGroup = await db.groups.find({ _id: group._id }).first();

  const restoredGroup = await db.groups.restore({ _id: group._id });

  log.info({
    context: 'team archive and restore',
    value: {
      hiddenFromDefaultReads: archivedGroup === null,
      restoredGroup,
    },
  });

  log.info({
    context: 'updated user',
    value: await db.users.update({ _id: user._id }, { role: 'admin', age: 20 }),
  });

  log.info({
    context: 'soft-deleted users',
    value: await db.users.delete({
      _id: {
        $in: [user._id, anotherUser._id],
      },
    }),
  });

  log.info({
    context: 'user soft-delete visibility',
    value: await db.users.find({ _id: user._id }).first(),
  });
};
