import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { createDatabase, orm } from '../../src/index.js';
import { env } from '../env.js';

const runDatabaseTests = Boolean(env.MONGODB_URI);
const database = createDatabase({
  uri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
  database: env.MONGODB_DATABASE,
});
const lifecycleSchema = orm
  .schema({ name: orm.string() })
  .options({ timestamps: true, softdelete: true });
const lifecycle = database.model('lifecycle', lifecycleSchema);

describe.skipIf(!runDatabaseTests)('model lifecycle', () => {
  beforeAll(() => database.connect());
  beforeEach(() => lifecycle.forceDelete({}));
  afterAll(() => database.disconnect());

  it('manages timestamps and soft deletion', async () => {
    const first = await lifecycle.create({ name: 'Ada' });
    const second = await lifecycle.create({ name: 'Alan' });

    expect(first.createdAt).toBeInstanceOf(Date);
    expect(first.updatedAt).toBeInstanceOf(Date);
    expect(first.deletedAt).toBeNull();
    expect(await lifecycle.filter({})).toHaveLength(2);

    const deleted = await lifecycle.delete({ _id: first._id });
    expect(deleted.deletedCount).toBe(1);
    expect(await lifecycle.filter({})).toHaveLength(1);
    expect(await lifecycle.filter({}).withDeleted()).toHaveLength(2);
    expect((await lifecycle.filter({}).onlyDeleted())[0]._id).toEqual(first._id);

    const restored = await lifecycle.restore({ _id: first._id });
    expect(restored?.deletedAt).toBeNull();
    expect(await lifecycle.filter({})).toHaveLength(2);

    const updated = await lifecycle.update({ _id: second._id }, { name: 'Alan Turing' });
    expect(updated?.name).toBe('Alan Turing');
    expect(updated?.updatedAt.getTime()).toBeGreaterThanOrEqual(second.updatedAt.getTime());
  });
});
