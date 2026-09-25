import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/libs/database';

describe('relation integration scenarios', () => {
  beforeAll(async () => db.connect());
  afterAll(async () => db.disconnect());
  afterEach(async () =>
    db.unsafe.purge({
      quiet: true,
    }),
  );

  it('simple: populates a user group with only its selected fields', async () => {
    const company = await db.companies.create({
      slug: 'relation-simple',
      name: 'Relation Scenarios',
      plan: 'growth',
      settings: {
        timezone: 'UTC',
        weeklyDigest: true,
        maxMembers: 10,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Platform',
      description: 'Owns platform work',
      permissions: {
        canInvite: true,
        canManageBilling: false,
        canExportData: true,
      },
    });
    const user = await db.users.create({
      name: 'Mina Patel',
      age: 30,
      role: 'member',
      password: 'secret',
      group: group._id,
      company: company._id,
      profile: {
        email: 'mina@example.test',
        website: 'https://mina.example.test',
        location: {
          city: 'Toronto',
          country: 'Canada',
        },
      },
    });

    const populated = await db.users
      .find({
        _id: user._id,
      })
      .populate([
        {
          ref: 'group',
          select: ['name'],
        },
      ])
      .first();

    expect(populated?.group?.name).toBe('Platform');
    expect(populated?.group).not.toHaveProperty('description');
  });

  it('complex: applies the user detail scope to populate nested relations', async () => {
    const company = await db.companies.create({
      slug: 'relation-scope',
      name: 'Scoped Company',
      plan: 'growth',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 20,
      },
    });
    const placeholderGroup = await db.groups.create({
      company: company._id,
      name: 'Placeholder',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: false,
      },
    });
    const creator = await db.users.create({
      name: 'Ari Chen',
      age: 34,
      role: 'admin',
      password: 'creator-secret',
      group: placeholderGroup._id,
      company: company._id,
      profile: {
        email: 'ari@example.test',
        website: 'https://ari.example.test',
        location: {
          city: 'Vancouver',
          country: 'Canada',
        },
      },
    });
    const group = await db.groups.create({
      company: company._id,
      creator: creator._id,
      name: 'Infrastructure',
      permissions: {
        canInvite: true,
        canManageBilling: false,
        canExportData: true,
      },
    });
    const user = await db.users.create({
      name: 'Noah Kim',
      age: 29,
      role: 'member',
      password: 'user-secret',
      group: group._id,
      company: company._id,
      profile: {
        email: 'noah@example.test',
        website: 'https://noah.example.test',
        location: {
          city: 'Calgary',
          country: 'Canada',
        },
      },
    });

    const detailed = await db.users
      .find({
        _id: user._id,
      })
      .with('detail')
      .first();

    expect(detailed?.group?.name).toBe('Infrastructure');
    expect(detailed?.group?.creator?.name).toBe('Ari Chen');
    expect(detailed?.company?.name).toBe('Scoped Company');
  });

  it('negative: unresolved relation ids populate as null', async () => {
    const company = await db.companies.create({
      slug: 'relation-missing',
      name: 'Missing Relation',
      plan: 'starter',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 5,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Unassigned',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: false,
      },
    });
    const user = await db.users.create({
      name: 'Orphaned Relation',
      age: 22,
      role: 'member',
      password: 'hidden',
      group: group._id,
      company: company._id,
      profile: {
        email: 'orphan@example.test',
        website: 'https://example.test',
        location: {
          city: 'Miami',
          country: 'United States',
        },
      },
    });
    await db.native.collection('groups').deleteOne({
      _id: group._id,
    });

    const populated = await db.users
      .find({
        _id: user._id,
      })
      .populate([
        {
          ref: 'group',
        },
      ])
      .first();

    expect(populated?.group).toBeNull();
  });
});
