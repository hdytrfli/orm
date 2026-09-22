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
  secret: orm.string().hidden(),
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
      secret: 'first-secret',
    });
    await tickets.create({
      title: 'Implement API',
      status: 'open',
      priority: 2,
      owner,
      secret: 'second-secret',
    });
    await tickets.create({
      title: 'Document API',
      status: 'closed',
      priority: 3,
      owner: otherOwner,
      secret: 'third-secret',
    });

    expect(first._id).toBeInstanceOf(ObjectId);
    expect((await tickets.filter({}))[0]).not.toHaveProperty('secret');
    expect((await tickets.filter({}).show(['secret']))[0]).toHaveProperty('secret');
    expect(await tickets.filter({ status: 'open', owner })).toHaveLength(2);
    expect(await tickets.filter()).toEqual(await tickets.filter({}));
    expect(await tickets.filter({ status: 'open' }).count()).toBe(2);
    expect(await tickets.filter().count(true)).toBeGreaterThanOrEqual(3);
    await expect(tickets.filter({ status: 'open' }).count(true)).rejects.toThrow(
      'do not support filters',
    );
    const firstPage = tickets.filter({}).limit(2).cursor();
    const firstResults = [];
    for await (const ticket of firstPage) firstResults.push(ticket);
    expect(firstResults).toHaveLength(2);
    expect(firstPage.next).toBeInstanceOf(ObjectId);
    const secondPage = await tickets
      .filter({})
      .limit(2)
      .cursor(firstPage.next ?? undefined);
    const secondResults = [];
    for await (const ticket of secondPage) secondResults.push(ticket);
    expect(secondResults).toHaveLength(1);
    expect(secondPage.next).toBeNull();
    expect(new Set([...firstResults, ...secondResults].map((ticket) => ticket._id)).size).toBe(3);
    const sorted = await tickets.filter({ status: 'open' }).sort({ priority: 'desc' });
    expect(sorted.map((ticket) => ticket.priority)).toEqual([2, 1]);
    const skipped = await tickets.filter({ status: 'open' }).sort({ priority: 'desc' }).skip(1);
    expect(skipped.map((ticket) => ticket.priority)).toEqual([1]);
    expect(() => tickets.filter({}).skip(-1)).toThrow('non-negative integer');
    const limited = await tickets.filter({ status: 'open' }).sort({ priority: 'desc' }).limit(1);
    expect(limited.map((ticket) => ticket.priority)).toEqual([2]);
    expect(() => tickets.filter({}).limit(-1)).toThrow('non-negative integer');
    const invalidCursorQuery = tickets
      .filter({})
      .limit(3)
      .sort({ priority: 'desc' })
      .skip(5) as any;
    expect(() => invalidCursorQuery.cursor()).toThrow('Cursor queries do not support skip');
    const selected = await tickets.filter({ status: 'open' }).select(['title', 'priority']);
    expect(selected[0]).toMatchObject({ title: 'Design API', priority: 1 });
    expect(Object.keys(selected[0])).toEqual(expect.arrayContaining(['_id', 'title', 'priority']));
    const selectedOne = await tickets.find({ title: 'Design API' }).select(['title']);
    expect(selectedOne).toMatchObject({ title: 'Design API' });
    expect(selectedOne).not.toHaveProperty('priority');
    expect((await tickets.find({ title: 'Design API' }))?._id).toEqual(first._id);

    const updated = await tickets.update({ _id: first._id }, { status: 'closed' });
    expect(updated).toMatchObject({ title: 'Design API', status: 'closed' });

    const deleted = await tickets.delete({ owner: otherOwner });
    expect(deleted.deletedCount).toBe(1);
    expect(await tickets.filter({})).toHaveLength(2);
  });
});
