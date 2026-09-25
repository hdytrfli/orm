import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/libs/database';

const createDirectory = async () => {
  const company = await db.companies.create({
    slug: 'query-scenarios',
    name: 'Query Scenarios',
    plan: 'growth',
    settings: {
      timezone: 'UTC',
      weeklyDigest: true,
      maxMembers: 10,
    },
  });
  const group = await db.groups.create({
    company: company._id,
    name: 'Research',
    permissions: {
      canInvite: true,
      canManageBilling: false,
      canExportData: true,
    },
  });
  return {
    company,
    group,
  };
};

describe('query integration scenarios', () => {
  beforeAll(async () => db.connect());
  afterAll(async () => db.disconnect());
  afterEach(async () =>
    db.unsafe.purge({
      quiet: true,
    }),
  );

  it('simple: filters and projects a nested user field', async () => {
    const { company, group } = await createDirectory();
    await db.users.create({
      name: 'Maya Chen',
      age: 32,
      role: 'admin',
      password: 'hidden-password',
      group: group._id,
      company: company._id,
      profile: {
        email: 'maya@example.test',
        website: 'https://maya.example.test',
        location: {
          city: 'Seattle',
          country: 'United States',
        },
      },
    });

    const users = await db.users
      .find({
        'profile.location.city': 'Seattle',
      })
      .select(['name', 'profile.location.city']);
    const [firstUser] = users;

    expect(users).toHaveLength(1);
    expect(firstUser?.name).toBe('Maya Chen');
    expect(firstUser?.profile.location.city).toBe('Seattle');
    expect(firstUser).not.toHaveProperty('password');
  });

  it('negative: returns no documents for a valid filter with no matches', async () => {
    const { company } = await createDirectory();

    const users = await db.users.find({
      company: company._id,
      age: {
        $gt: 120,
      },
    });
    const resultCount = await db.users
      .find({
        company: company._id,
        age: {
          $gt: 120,
        },
      })
      .count();

    expect(users).toEqual([]);
    expect(resultCount).toBe(0);
  });

  it('edge case: explicitly shows hidden data only when requested', async () => {
    const { company, group } = await createDirectory();
    const user = await db.users.create({
      name: 'Hidden Field User',
      age: 29,
      role: 'member',
      password: 'visible-on-request',
      group: group._id,
      company: company._id,
      profile: {
        email: 'hidden@example.test',
        website: 'https://example.test',
        location: {
          city: 'Boston',
          country: 'United States',
        },
      },
    });

    const hiddenByDefault = await db.users
      .find({
        _id: user._id,
      })
      .first();
    const explicitlyShown = await db.users
      .find({
        _id: user._id,
      })
      .show(['password'])
      .first();

    expect(hiddenByDefault).not.toHaveProperty('password');
    expect(explicitlyShown?.password).toBe('visible-on-request');
  });

  it('edge case: filters optional fields that are absent rather than null', async () => {
    const { company, group } = await createDirectory();
    const user = await db.users.create({
      name: 'No Username',
      age: 24,
      role: 'member',
      password: 'hidden',
      group: group._id,
      company: company._id,
      profile: {
        email: 'no-username@example.test',
        website: 'https://example.test',
        location: {
          city: 'Austin',
          country: 'United States',
        },
      },
    });

    const missing = await db.users
      .find({
        _id: user._id,
        username: {
          $exists: false,
        },
      })
      .first();
    const present = await db.users
      .find({
        _id: user._id,
        username: {
          $exists: true,
        },
      })
      .first();

    expect(missing?.name).toBe('No Username');
    expect(present).toBeNull();
  });

  it('counts exact matches and rejects estimated counts when a filter is present', async () => {
    const { company, group } = await createDirectory();
    const user = await db.users.create({
      name: 'Count User',
      age: 29,
      role: 'member',
      password: 'hidden',
      group: group._id,
      company: company._id,
      profile: {
        email: 'count@example.test',
        website: 'https://example.test',
        location: {
          city: 'Austin',
          country: 'United States',
        },
      },
    });

    const exactCount = await db.users
      .find({
        _id: user._id,
      })
      .count();
    expect(exactCount).toBe(1);
    await expect(
      db.users
        .find({
          _id: user._id,
        })
        .count(true),
    ).rejects.toThrow('do not support filters');
    const estimatedCount = await db.users.find().deleted('include').count(true);
    expect(estimatedCount).toBeGreaterThanOrEqual(1);
  });

  it('complex: combines tenant, range, and logical filters without leaking another tenant', async () => {
    const { company, group } = await createDirectory();
    const otherCompany = await db.companies.create({
      slug: 'query-other-tenant',
      name: 'Other Tenant',
      plan: 'starter',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 5,
      },
    });
    const otherGroup = await db.groups.create({
      company: otherCompany._id,
      name: 'Other Team',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: false,
      },
    });
    const users = [
      {
        name: 'Young Admin',
        age: 17,
        companyId: company._id,
        groupId: group._id,
      },
      {
        name: 'Adult Admin',
        age: 35,
        companyId: company._id,
        groupId: group._id,
      },
      {
        name: 'Other Tenant Admin',
        age: 40,
        companyId: otherCompany._id,
        groupId: otherGroup._id,
      },
    ];
    for (const user of users) {
      await db.users.create({
        name: user.name,
        age: user.age,
        role: 'admin',
        password: 'hidden',
        group: user.groupId,
        company: user.companyId,
        profile: {
          email: user.name.toLowerCase().replaceAll(' ', '.') + '@example.test',
          website: 'https://example.test',
          location: {
            city: 'Seattle',
            country: 'United States',
          },
        },
      });
    }

    const results = await db.users.find({
      company: company._id,
      $and: [
        {
          role: 'admin',
        },
        {
          age: {
            $gte: 18,
            $lte: 60,
          },
        },
      ],
    });
    const [firstResult] = results;

    expect(results).toHaveLength(1);
    expect(firstResult?.name).toBe('Adult Admin');
  });

  it('real world: sorts and pages a tenant-scoped directory', async () => {
    const { company, group } = await createDirectory();
    const profiles = [
      {
        name: 'Zoe Park',
        age: 31,
        city: 'Seattle',
      },
      {
        name: 'Ari Kim',
        age: 28,
        city: 'Portland',
      },
      {
        name: 'Sam Lee',
        age: 35,
        city: 'Seattle',
      },
    ];
    for (const profile of profiles) {
      await db.users.create({
        ...profile,
        role: 'member',
        password: 'directory-secret',
        group: group._id,
        company: company._id,
        profile: {
          email: profile.name.toLowerCase().replaceAll(' ', '.') + '@example.test',
          website: 'https://example.test',
          location: {
            city: profile.city,
            country: 'United States',
          },
        },
      });
    }

    const page = await db.users
      .find({
        company: company._id,
        age: {
          $gte: 28,
        },
      })
      .select(['name', 'age'])
      .sort({
        name: 'asc',
      })
      .skip(1)
      .limit(1);
    const [firstUser] = page;

    expect(page).toHaveLength(1);
    expect(firstUser?.name).toBe('Sam Lee');
    expect(firstUser?.age).toBe(35);
    expect(firstUser).not.toHaveProperty('password');
  });
});
