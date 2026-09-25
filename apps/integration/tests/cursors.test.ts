import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { db } from '@/libs/database';

describe('cursor integration scenarios', () => {
  beforeAll(async () => db.connect());
  afterAll(async () => db.disconnect());
  afterEach(async () =>
    db.unsafe.purge({
      quiet: true,
    }),
  );

  it('simple: streams all matching documents without a limit', async () => {
    const company = await db.companies.create({
      slug: 'cursor-stream',
      name: 'Cursor Scenarios',
      plan: 'growth',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 10,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Export',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: true,
      },
    });
    const names = ['Ada', 'Grace', 'Alan'];
    for (const name of names) {
      await db.users.create({
        name,
        age: 30,
        role: 'member',
        password: 'hidden',
        group: group._id,
        company: company._id,
        profile: {
          email: name.toLowerCase() + '@example.test',
          website: 'https://example.test',
          location: {
            city: 'London',
            country: 'United Kingdom',
          },
        },
      });
    }

    const streamed: string[] = [];
    for await (const user of db.users
      .find({
        company: company._id,
      })
      .select(['name'])
      .cursor()) {
      streamed.push(user.name);
    }

    expect(streamed.sort()).toEqual(['Ada', 'Alan', 'Grace']);
  });

  it('pagination: returns a bounded cursor page in stable id order', async () => {
    const company = await db.companies.create({
      slug: 'cursor-pages',
      name: 'Cursor Pages',
      plan: 'growth',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 10,
      },
    });
    const group = await db.groups.create({
      company: company._id,
      name: 'Export Pages',
      permissions: {
        canInvite: false,
        canManageBilling: false,
        canExportData: true,
      },
    });
    for (const name of ['Ada', 'Grace', 'Alan']) {
      await db.users.create({
        name,
        age: 30,
        role: 'member',
        password: 'hidden',
        group: group._id,
        company: company._id,
        profile: {
          email: name.toLowerCase() + '@example.test',
          website: 'https://example.test',
          location: {
            city: 'London',
            country: 'United Kingdom',
          },
        },
      });
    }

    const firstPage = db.users
      .find({
        company: company._id,
      })
      .limit(2)
      .cursor();
    const firstResults = [];
    for await (const user of firstPage) firstResults.push(user);

    const secondPage = await db.users
      .find({
        company: company._id,
      })
      .limit(2)
      .cursor(firstPage.next ?? undefined);
    const secondResults = [];
    for await (const user of secondPage) secondResults.push(user);

    expect(firstResults).toHaveLength(2);
    expect(secondResults).toHaveLength(1);
    expect(firstPage.next).toBeDefined();
    expect(secondPage.next).toBeNull();
  });
});
