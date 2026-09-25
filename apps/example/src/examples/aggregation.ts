import { db } from '@/libs/database';
import { log } from '@/utils/logger';

type UserCountByCountry = { _id: string; count: number };
type UsersByRole = { _id: string; count: number; averageAge: number };
type TasksByPriority = { _id: string; estimatedHours: number };

export const demonstrateAggregation = async () => {
  const company = await db.companies.create({
    slug: 'analytics-lab',
    name: 'Analytics Lab',
    plan: 'growth',
    settings: {
      timezone: 'UTC',
      weeklyDigest: true,
      maxMembers: 100,
    },
  });

  const group = await db.groups.create({
    company: company._id,
    name: 'Insights',
    permissions: {
      canInvite: true,
      canManageBilling: false,
      canExportData: true,
    },
  });

  const users = [
    { name: 'Priya Shah', age: 41, role: 'admin' as const, city: 'Toronto', country: 'Canada' },
    { name: 'Marco Rossi', age: 29, role: 'member' as const, city: 'Milan', country: 'Italy' },
    { name: 'Isabel Costa', age: 35, role: 'member' as const, city: 'Lisbon', country: 'Portugal' },
    { name: 'Noah Kim', age: 24, role: 'member' as const, city: 'Toronto', country: 'Canada' },
    { name: 'Grace Liu', age: 46, role: 'admin' as const, city: 'Vancouver', country: 'Canada' },
  ];

  const [owner] = await db.users.bulk.create(
    users.map(({ name, age, role, city, country }) => ({
      name,
      age,
      role,
      password: `secret-${name.toLowerCase().replaceAll(' ', '-')}`,
      group: group._id,
      company: company._id,
      profile: {
        email: `${name.toLowerCase().replaceAll(' ', '.')}@example.test`,
        website: 'https://analytics.example.test',
        location: {
          city,
          country,
        },
      },
    })),
  );

  if (!owner) throw new Error('Expected at least one analytics user');

  const project = await db.projects.create({
    company: company._id,
    owner: owner._id,
    key: 'INSIGHTS',
    name: 'Product insights',
    status: 'active',
    visibility: 'company',
    metadata: {
      color: '#2b8a78',
      tags: ['analytics'],
    },
  });

  await db.tasks.bulk.create([
    {
      project: project._id,
      createdBy: owner._id,
      title: 'Build weekly report',
      status: 'in_progress',
      priority: 'high',
      labels: ['reporting'],
      dueAt: null,
      estimateHours: 8,
      audit: {
        source: 'manual',
      },
    },
    {
      project: project._id,
      createdBy: owner._id,
      title: 'Validate event taxonomy',
      status: 'todo',
      priority: 'normal',
      labels: ['instrumentation'],
      dueAt: null,
      estimateHours: 5,
      audit: {
        source: 'import',
        externalId: 'DATA-77',
      },
    },
  ]);

  const counts = await db.users.aggregate<UserCountByCountry>([
    {
      $group: {
        _id: '$profile.location.country',
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        _id: 1,
      },
    },
  ]);

  log.info({
    context: 'users grouped by country',
    value: counts,
  });

  // Tenant analytics: filter source documents before grouping, then calculate a metric.

  const roleSummary = await db.users.aggregate<UsersByRole>(
    [
      {
        $group: {
          _id: '$role',
          count: {
            $sum: 1,
          },
          averageAge: {
            $avg: '$age',
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
    ],
    {
      filter: {
        company: company._id,
      },
    },
  );

  log.info({
    context: 'company user role analytics',
    value: roleSummary,
  });

  // A pipeline match can filter intermediate output after the source filter.

  const adultUsers = await db.users.aggregate<UserCountByCountry>(
    [
      {
        $match: {
          age: {
            $gte: 18,
          },
        },
      },
      {
        $group: {
          _id: '$profile.location.country',
          count: {
            $sum: 1,
          },
        },
      },
      {
        $sort: {
          count: -1,
        },
      },
      { $limit: 5 },
    ],
    {
      filter: {
        company: company._id,
      },
    },
  );

  log.info({
    context: 'top countries among adult members',
    value: adultUsers,
  });

  const noMatchingUsers = await db.users.aggregate<UserCountByCountry>(
    [
      {
        $match: {
          age: {
            $gt: 120,
          },
        },
      },
      {
        $group: {
          _id: '$profile.location.country',
          count: {
            $sum: 1,
          },
        },
      },
    ],
    {
      filter: {
        company: company._id,
      },
    },
  );

  log.info({
    context: 'aggregate over an empty match',
    value: noMatchingUsers,
  });

  // Operations reporting: total estimated effort by task priority for one project.

  const effortByPriority = await db.tasks.aggregate<TasksByPriority>(
    [
      {
        $group: {
          _id: '$priority',
          estimatedHours: {
            $sum: '$estimateHours',
          },
        },
      },
      {
        $sort: {
          estimatedHours: -1,
        },
      },
    ],
    {
      filter: {
        project: project._id,
      },
    },
  );

  log.info({
    context: 'estimated project effort by priority',
    value: effortByPriority,
  });

  // Async iteration is useful when a report might produce many groups.

  let streamedCountries = 0;
  const userCountByCountry = db.users.aggregate<UserCountByCountry>([
    {
      $group: {
        _id: '$profile.location.country',
        count: {
          $sum: 1,
        },
      },
    },
    {
      $sort: {
        count: -1,
      },
    },
  ]);

  for await (const country of userCountByCountry) {
    streamedCountries += 1;
    if (streamedCountries <= 3) {
      log.info({
        context: 'streamed country aggregate row',
        value: country,
      });
    }
  }

  log.info({
    context: 'streamed aggregate group count',
    value: streamedCountries,
  });
};
