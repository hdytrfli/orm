import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import { db } from '@/libs/database';

describe('unsafe database integration scenarios', () => {
  beforeAll(async () => db.connect());
  afterAll(async () => db.disconnect());
  afterEach(() =>
    db.unsafe.purge({
      quiet: true,
    }),
  );

  it('warns before permanently purging all registered collections', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const company = await db.companies.create({
      slug: 'unsafe-purge-warning',
      name: 'Purge Warning',
      plan: 'starter',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 3,
      },
    });

    const deletedCount = await db.unsafe.purge();
    const [[warningMessage]] = warning.mock.calls;

    expect(warning).toHaveBeenCalledOnce();
    expect(warningMessage).toContain('permanently deletes');
    expect(deletedCount).toBeGreaterThanOrEqual(1);
    const remainingCompany = await db.companies
      .find({
        _id: company._id,
      })
      .first();
    expect(remainingCompany).toBeNull();
    warning.mockRestore();
  });

  it('quietly purges registered collections when explicitly requested', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await db.companies.create({
      slug: 'unsafe-purge-quiet',
      name: 'Quiet Purge',
      plan: 'starter',
      settings: {
        timezone: 'UTC',
        weeklyDigest: false,
        maxMembers: 3,
      },
    });

    const deletedCount = await db.unsafe.purge({
      quiet: true,
    });

    expect(warning).not.toHaveBeenCalled();
    expect(deletedCount).toBeGreaterThanOrEqual(1);
    warning.mockRestore();
  });

  it('warns when sync is asked to drop indexes', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await db.sync({
      dropIndexes: true,
    });
    const [[warningMessage]] = warning.mock.calls;

    expect(warning).toHaveBeenCalledOnce();
    expect(warningMessage).toContain('drops indexes');
    warning.mockRestore();
  });

  it('suppresses the drop-index warning when quiet is enabled', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await db.sync({
      dropIndexes: true,
      quiet: true,
    });

    expect(warning).not.toHaveBeenCalled();
    warning.mockRestore();
  });
});
