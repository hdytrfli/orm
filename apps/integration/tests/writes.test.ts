import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/libs/database';

describe('write integration scenarios', () => {
  beforeAll(async () => db.connect());
  afterAll(async () => db.disconnect());
  afterEach(async () =>
    db.unsafe.purge({
      quiet: true,
    }),
  );

  it('simple: creates a document and updates only the requested fields', async () => {
    const company = await db.companies.create({
      slug: 'writes-simple',
      name: 'Write Scenarios',
      plan: 'growth',
      settings: {
        timezone: 'UTC',
        weeklyDigest: true,
        maxMembers: 10,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Design',
      permissions: {
        canInvite: true,
        canManageBilling: false,
        canExportData: false,
      },
    });
    const user = await db.users.create({
      name: 'Before Update',
      age: 25,
      role: 'member',
      password: 'hidden',
      group: group._id,
      company: company._id,
      profile: {
        email: 'before@example.test',
        website: 'https://example.test',
        location: {
          city: 'Austin',
          country: 'United States',
        },
      },
    });

    const updated = await db.users.update(
      {
        _id: user._id,
      },
      {
        name: 'After Update',
        age: 26,
      },
    );

    expect(updated?.name).toBe('After Update');
    expect(updated?.age).toBe(26);
    expect(
      (
        await db.users
          .find({
            _id: user._id,
          })
          .first()
      )?.name,
    ).toBe('After Update');
  });

  it('idempotent: upserts the same tenant username instead of duplicating it', async () => {
    const company = await db.companies.create({
      slug: 'writes-upsert',
      name: 'Upsert Scenarios',
      plan: 'growth',
      settings: {
        timezone: 'UTC',
        weeklyDigest: true,
        maxMembers: 10,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Provisioning',
      permissions: {
        canInvite: true,
        canManageBilling: false,
        canExportData: false,
      },
    });
    const filter = {
      company: company._id,
      username: 'service-account',
    };
    const data = {
      name: 'Service Account',
      age: 1,
      role: 'member' as const,
      password: 'hidden',
      group: group._id,
      profile: {
        email: 'service@example.test',
        website: 'https://example.test',
        location: {
          city: 'Seattle',
          country: 'United States',
        },
      },
    };

    const first = await db.users.upsert(filter, data);
    const second = await db.users.upsert(filter, {
      ...data,
      name: 'Updated Service Account',
    });
    const matchingUserCount = await db.users.find(filter).count();

    expect(first._id).toEqual(second._id);
    expect(second.name).toBe('Updated Service Account');
    expect(matchingUserCount).toBe(1);
  });

  it('bulk: inserts multiple valid documents and returns each generated id', async () => {
    const company = await db.companies.create({
      slug: 'writes-bulk',
      name: 'Bulk Scenarios',
      plan: 'starter',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 10,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Imports',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: true,
      },
    });
    const input = ['First Import', 'Second Import'].map((name) => ({
      name,
      age: 30,
      role: 'member' as const,
      password: 'hidden',
      group: group._id,
      company: company._id,
      profile: {
        email: name.toLowerCase().replaceAll(' ', '.') + '@example.test',
        website: 'https://example.test',
        location: {
          city: 'Denver',
          country: 'United States',
        },
      },
    }));

    const created = await db.users.bulk.create(input);
    const userCount = await db.users
      .find({
        company: company._id,
      })
      .count();

    expect(created).toHaveLength(2);
    expect(created.every((user) => user._id)).toBe(true);
    expect(userCount).toBe(2);
  });

  it('negative: does not update or restore a document that does not match', async () => {
    const result = await db.users.update(
      {
        name: 'Missing User',
      },
      {
        age: 40,
      },
    );
    const restored = await db.users.restore({
      name: 'Missing User',
    });

    expect(result).toBeNull();
    expect(restored).toBeNull();
  });

  it('edge case: rejects invalid document data instead of persisting it', async () => {
    const company = await db.companies.create({
      slug: 'writes-invalid',
      name: 'Validation Scenarios',
      plan: 'starter',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 5,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Validation',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: false,
      },
    });
    const invalidInput = {
      name: 'Invalid User',
      age: 30,
      role: 'superadmin',
      password: 'hidden',
      group: group._id,
      company: company._id,
      profile: {
        email: 'invalid@example.test',
        website: 'https://example.test',
        location: {
          city: 'Miami',
          country: 'United States',
        },
      },
    } as never;

    await expect(db.users.create(invalidInput)).rejects.toThrow('Invalid option');
    const invalidUsers = await db.users.find({
      name: 'Invalid User',
    });
    expect(invalidUsers).toEqual([]);
  });

  it('complex: soft-deletes a user, hides it by default, then restores it', async () => {
    const company = await db.companies.create({
      slug: 'writes-soft-delete',
      name: 'Lifecycle Scenarios',
      plan: 'growth',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 10,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Operations',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: false,
      },
    });
    const user = await db.users.create({
      name: 'Lifecycle User',
      age: 37,
      role: 'admin',
      password: 'hidden',
      group: group._id,
      company: company._id,
      profile: {
        email: 'lifecycle@example.test',
        website: 'https://example.test',
        location: {
          city: 'Denver',
          country: 'United States',
        },
      },
    });

    await db.users.delete({
      _id: user._id,
    });

    const activeUser = await db.users
      .find({
        _id: user._id,
      })
      .first();
    const deletedUser = await db.users
      .find({
        _id: user._id,
      })
      .deleted('only')
      .first();
    const restoredUser = await db.users.restore({
      _id: user._id,
    });
    const visibleRestoredUser = await db.users
      .find({
        _id: user._id,
      })
      .first();

    expect(activeUser).toBeNull();
    expect(deletedUser?.name).toBe('Lifecycle User');
    expect(restoredUser?.deletedAt).toBeNull();
    expect(visibleRestoredUser?.name).toBe('Lifecycle User');
  });
});
