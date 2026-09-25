import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/libs/database';

describe('aggregation integration scenarios', () => {
  beforeAll(async () => db.connect());
  afterAll(async () => db.disconnect());
  afterEach(async () =>
    db.unsafe.purge({
      quiet: true,
    }),
  );

  it('simple: groups tenant users by role and calculates average age', async () => {
    const company = await db.companies.create({
      slug: 'aggregation-simple',
      name: 'Analytics Scenarios',
      plan: 'growth',
      settings: {
        timezone: 'UTC',
        weeklyDigest: true,
        maxMembers: 10,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Data',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: true,
      },
    });
    const users = [
      {
        name: 'Priya Shah',
        role: 'admin' as const,
        age: 40,
      },
      {
        name: 'Marco Rossi',
        role: 'member' as const,
        age: 28,
      },
      {
        name: 'Noah Kim',
        role: 'member' as const,
        age: 32,
      },
    ];
    for (const user of users) {
      await db.users.create({
        ...user,
        password: 'hidden',
        group: group._id,
        company: company._id,
        profile: {
          email: user.name.toLowerCase().replaceAll(' ', '.') + '@example.test',
          website: 'https://example.test',
          location: {
            city: 'Toronto',
            country: 'Canada',
          },
        },
      });
    }

    const summary = await db.users.aggregate<{
      _id: string;
      count: number;
      averageAge: number;
    }>(
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
            _id: 1,
          },
        },
      ],
      {
        filter: {
          company: company._id,
        },
      },
    );

    expect(summary).toEqual([
      {
        _id: 'admin',
        count: 1,
        averageAge: 40,
      },
      {
        _id: 'member',
        count: 2,
        averageAge: 30,
      },
    ]);
  });

  it('negative: returns no groups when the tenant filter matches no documents', async () => {
    const company = await db.companies.create({
      slug: 'aggregation-empty',
      name: 'Empty Analytics',
      plan: 'starter',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 5,
      },
    });

    const summary = await db.users.aggregate<{
      _id: string;
      count: number;
    }>(
      [
        {
          $group: {
            _id: '$role',
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

    expect(summary).toEqual([]);
  });
});
