import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ObjectId, createDatabase, orm } from '../src/index.js';

const runDatabaseTests = Boolean(process.env.MONGODB_URI);

const database = createDatabase({
  uri: process.env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
  database: process.env.MONGODB_DATABASE ?? 'mongorm_crud_test',
});

const ticketSchema = orm.schema({
  title: orm.string(),
  status: orm.enum(['open', 'closed']),
  priority: orm.number(),
  owner: orm.objectId(),
});

const tickets = database.model('tickets', ticketSchema);

describe.skipIf(!runDatabaseTests)('database CRUD', () => {
  beforeAll(() => database.connect());
  beforeEach(() => tickets.delete({}));
  afterAll(() => database.disconnect());

  it('creates, filters, finds, updates, and deletes typed documents', async () => {
    const owner = new ObjectId();
    const otherOwner = new ObjectId();
    const first = await tickets.create({
      title: 'Design API',
      status: 'open',
      priority: 1,
      owner,
    });
    await tickets.create({
      title: 'Implement API',
      status: 'open',
      priority: 2,
      owner,
    });
    await tickets.create({
      title: 'Document API',
      status: 'closed',
      priority: 3,
      owner: otherOwner,
    });

    expect(first._id).toBeInstanceOf(ObjectId);
    expect(await tickets.filter({ status: 'open', owner })).toHaveLength(2);
    expect((await tickets.find({ title: 'Design API' }))?._id).toEqual(first._id);

    const updated = await tickets.update({ _id: first._id }, { status: 'closed' });
    expect(updated).toMatchObject({ title: 'Design API', status: 'closed' });

    const deleted = await tickets.delete({ owner: otherOwner });
    expect(deleted.deletedCount).toBe(1);
    expect(await tickets.filter({})).toHaveLength(2);
  });
});
