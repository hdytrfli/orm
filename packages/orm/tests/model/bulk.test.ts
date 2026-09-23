import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../../src/connection/database.js';
import { orm } from '../../src/index.js';
import { Model } from '../../src/model/model.js';

describe('bulk model operations', () => {
  it('validates inputs and inserts all prepared documents at once', async () => {
    const insertMany = vi
      .fn<(documents: unknown[]) => Promise<unknown>>()
      .mockResolvedValue({ acknowledged: true, insertedCount: 2 });
    const collection = { insertMany };
    const database = {
      native: { collection: () => collection },
    } as unknown as Db;
    const model = new Model(database, 'users', orm.schema({ name: orm.string() }));

    const created = await model.bulk.create([{ name: 'Ada' }, { name: 'Alan' }]);

    expect(insertMany).toHaveBeenCalledOnce();
    expect(insertMany).toHaveBeenCalledWith(created);
    expect(created).toHaveLength(2);
    expect(created[0]._id).toBeDefined();
    expect(created[1]._id).toBeDefined();
    expect(created[0]._id).not.toEqual(created[1]._id);
  });

  it('validates the complete batch before writing', async () => {
    const insertMany = vi.fn<(documents: unknown[]) => Promise<unknown>>();
    const database = {
      native: { collection: () => ({ insertMany }) },
    } as unknown as Db;
    const model = new Model(database, 'users', orm.schema({ name: orm.string() }));

    await expect(model.bulk.create([{ name: 'Ada' }, { name: 42 as never }])).rejects.toThrow(
      /string/,
    );
    expect(insertMany).not.toHaveBeenCalled();
  });
});
