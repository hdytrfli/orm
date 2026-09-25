import { faker } from '@faker-js/faker';

import { db } from '@/libs/database';
import { env } from '@/libs/env';
import { log } from '@/utils/logger';

export const demonstrateCursors = async () => {
  faker.seed(env.FAKER_SEED + 1);

  const company = await db.companies.create({
    slug: 'cursor-lab',
    name: 'Cursor Lab',
    plan: 'starter',
    settings: { timezone: 'UTC', weeklyDigest: false, maxMembers: 30 },
  });

  const group = await db.groups.create({
    company: company._id,
    name: 'Directory Operations',
    permissions: { canInvite: true, canManageBilling: false, canExportData: false },
  });

  const users = Array.from({ length: 12 }, (_, index) => {
    const name = faker.person.fullName();

    return {
      name,
      username: `cursor-${index}`,
      age: faker.number.int({ min: 20, max: 65 }),
      role: index === 0 ? ('admin' as const) : ('member' as const),
      password: faker.internet.password(),
      group: group._id,
      company: company._id,
      profile: {
        email: `cursor-${index}@example.test`,
        website: faker.internet.url(),
        location: { city: faker.location.city(), country: faker.location.country() },
      },
    };
  });

  await db.users.bulk.create(users);

  // Cursor pages are bounded and ordered by `_id`; unlike array reads, they can resume.

  const firstPage = db.users.find({ company: company._id }).limit(3).cursor();

  let count = 0;
  for await (const user of firstPage) {
    log.info({
      context: 'cursor item',
      value: { page: 1, count: ++count, user },
    });
  }

  const secondPage = db.users
    .find({ company: company._id })
    .limit(3)
    .cursor(firstPage.next ?? undefined);

  for await (const user of secondPage) {
    log.info({
      context: 'cursor item',
      value: { page: 2, count: ++count, user },
    });
  }

  log.info({
    context: 'cursor continuation',
    value: secondPage.next,
  });

  // Continue fetching pages until exhausted, without materializing the full directory.

  let streamedUsers = 0;
  let after = secondPage.next;
  while (after) {
    const page = db.users.find({ company: company._id }).limit(3).cursor(after);

    for await (const user of page) {
      streamedUsers += 1;
      if (streamedUsers <= 3) {
        log.info({
          context: 'continued directory page',
          value: user,
        });
      }
    }
    after = page.next;
  }

  log.info({
    context: 'remaining directory pages complete',
    value: { streamedUsers },
  });
};
