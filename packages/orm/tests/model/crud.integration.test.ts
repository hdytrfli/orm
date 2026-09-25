import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { ObjectId, createDatabase, orm } from '../../src/index.js';
import { env } from '../env.js';

const runDatabaseTests = Boolean(env.MONGODB_URI);

const database = createDatabase({
  uri: env.MONGODB_URI ?? 'mongodb://127.0.0.1:27017',
  database: env.MONGODB_DATABASE,
});

const ticketSchema = orm.schema({
  title: orm.string(),
  status: orm.enum(['open', 'closed']),
  priority: orm.number(),
  owner: orm.objectId(),
  secret: orm.string().hidden(),
});
const ownerSchema = orm.schema({ name: orm.string(), secret: orm.string().hidden() });
const relatedTicketSchema = ticketSchema.relations({ owner: () => ownerSchema });

const owners = database.model('owners', ownerSchema);
const tickets = database.model('tickets', relatedTicketSchema);

describe.skipIf(!runDatabaseTests)('database CRUD', () => {
  beforeAll(() => database.connect());
  beforeEach(async () => {
    await tickets.delete({});
    await owners.delete({});
  });
  afterAll(() => database.disconnect());

  it('creates, filters, finds, updates, and deletes typed documents', async () => {
    const owner = await owners.create({ name: 'Ada', secret: 'ada-owner-secret' });
    const otherOwner = await owners.create({ name: 'Alan', secret: 'alan-owner-secret' });
    const first = await tickets.create({
      title: 'Design API',
      status: 'open',
      priority: 1,
      owner: owner._id,
      secret: 'first-secret',
    });
    await tickets.create({
      title: 'Implement API',
      status: 'open',
      priority: 2,
      owner: owner._id,
      secret: 'second-secret',
    });
    await tickets.create({
      title: 'Document API',
      status: 'closed',
      priority: 3,
      owner: otherOwner._id,
      secret: 'third-secret',
    });

    expect(first._id).toBeInstanceOf(ObjectId);
    expect((await tickets.find({}))[0]).not.toHaveProperty('secret');
    expect((await tickets.find({}).show(['secret']))[0]).toHaveProperty('secret');
    const defaultSelection = await tickets.find({}).select();
    expect(defaultSelection[0]).not.toHaveProperty('secret');
    expect(await tickets.find({ status: 'open', owner: owner._id })).toHaveLength(2);
    expect(await tickets.find({ title: 'Missing ticket' }).first()).toBeNull();
    const populated = await tickets
      .find({ status: 'open' })
      .populate([{ ref: 'owner', select: ['name'], show: ['secret'] }]);
    expect(populated[0].owner?.name).toBe('Ada');
    expect(populated[0].owner?.secret).toBe('ada-owner-secret');
    expect(populated[0].owner).toHaveProperty('_id');
    const populatedCursor = tickets
      .find({ status: 'open' })
      .populate([{ ref: 'owner', select: ['name'] }])
      .limit(1)
      .cursor();
    const cursorDocuments = [];
    for await (const ticket of populatedCursor) cursorDocuments.push(ticket);
    expect(cursorDocuments[0].owner?.name).toBe('Ada');
    expect(cursorDocuments[0].owner).not.toHaveProperty('secret');
    expect(await tickets.find()).toEqual(await tickets.find({}));
    expect(await tickets.find({ status: 'open' }).count()).toBe(2);
    expect(await tickets.find().count(true)).toBeGreaterThanOrEqual(3);
    await expect(tickets.find({ status: 'open' }).count(true)).rejects.toThrow(
      'do not support filters',
    );
    const firstPage = tickets.find({}).limit(2).cursor();
    const firstResults = [];
    for await (const ticket of firstPage) firstResults.push(ticket);
    expect(firstResults).toHaveLength(2);
    expect(firstPage.next).toBeInstanceOf(ObjectId);
    const secondPage = await tickets
      .find({})
      .limit(2)
      .cursor(firstPage.next ?? undefined);
    const secondResults = [];
    for await (const ticket of secondPage) secondResults.push(ticket);
    expect(secondResults).toHaveLength(1);
    expect(secondPage.next).toBeNull();
    expect(new Set([...firstResults, ...secondResults].map((ticket) => ticket._id)).size).toBe(3);
    const projectedPage = tickets.find({}).select(['title']).limit(2).cursor();
    for await (const ticket of projectedPage) {
      expect(ticket).toHaveProperty('title');
      expect(ticket).not.toHaveProperty('secret');
      expect(ticket).not.toHaveProperty('priority');
    }
    const sorted = await tickets.find({ status: 'open' }).sort({ priority: 'desc' });
    expect(sorted.map((ticket) => ticket.priority)).toEqual([2, 1]);
    const skipped = await tickets.find({ status: 'open' }).sort({ priority: 'desc' }).skip(1);
    expect(skipped.map((ticket) => ticket.priority)).toEqual([1]);
    expect(() => tickets.find({}).skip(-1)).toThrow('non-negative integer');
    const limited = await tickets.find({ status: 'open' }).sort({ priority: 'desc' }).limit(1);
    expect(limited.map((ticket) => ticket.priority)).toEqual([2]);
    expect(() => tickets.find({}).limit(-1)).toThrow('non-negative integer');
    const invalidCursorQuery = tickets.find({}).limit(3).sort({ priority: 'desc' }).skip(5) as any;
    expect(() => invalidCursorQuery.cursor()).toThrow('Cursor queries do not support skip');
    expect(() => tickets.find({}).cursor()).toThrow('Cursor queries require a positive limit');
    expect(() => (tickets.find({}).limit(3).sort({ priority: 'desc' }).cursor as any)()).toThrow(
      'default _id ascending sort',
    );
    const selected = await tickets.find({ status: 'open' }).select(['title', 'priority']);
    expect(selected[0]).toMatchObject({ title: 'Design API', priority: 1 });
    expect(Object.keys(selected[0])).toEqual(expect.arrayContaining(['_id', 'title', 'priority']));
    const selectedOne = await tickets.find({ title: 'Design API' }).select(['title']).first();
    expect(selectedOne).toMatchObject({ title: 'Design API' });
    expect(selectedOne).not.toHaveProperty('priority');
    expect((await tickets.find({ title: 'Design API' }).first())?._id).toEqual(first._id);

    const updated = await tickets.update({ _id: first._id }, { status: 'closed' });
    expect(updated).toMatchObject({ title: 'Design API', status: 'closed' });

    const deleted = await tickets.delete({ owner: otherOwner._id });
    expect(deleted.deletedCount).toBe(1);
    expect(await tickets.find({})).toHaveLength(2);
  });

  it('bulk creates validated documents with generated ids', async () => {
    const owner = await owners.create({ name: 'Grace', secret: 'grace-owner-secret' });
    const created = await tickets.bulk.create([
      {
        title: 'Bulk one',
        status: 'open',
        priority: 1,
        owner: owner._id,
        secret: 'first-secret',
      },
      {
        title: 'Bulk two',
        status: 'closed',
        priority: 2,
        owner: owner._id,
        secret: 'second-secret',
      },
    ]);

    expect(created).toHaveLength(2);
    expect(created[0]._id).toBeInstanceOf(ObjectId);
    expect(created[0]._id).not.toEqual(created[1]._id);
    expect(await tickets.find({})).toHaveLength(2);
    expect((await tickets.find({}).show(['secret']))[1].secret).toBe('second-secret');
  });

  it('upserts complete data on a miss or match', async () => {
    const owner = await owners.create({ name: 'Katherine', secret: 'katherine-owner-secret' });
    const filter = { title: 'Upsert API' };
    const firstData = {
      status: 'open' as const,
      priority: 1,
      owner: owner._id,
      secret: 'upsert-secret',
    };

    const inserted = await tickets.upsert(filter, firstData);
    expect(inserted).toMatchObject({
      title: 'Upsert API',
      status: 'open',
      priority: 1,
      secret: 'upsert-secret',
    });
    expect(inserted._id).toBeInstanceOf(ObjectId);

    const updated = await tickets.upsert(filter, {
      ...firstData,
      status: 'closed',
      priority: 5,
    });
    expect(updated._id).toEqual(inserted._id);
    expect(updated).toMatchObject({
      title: 'Upsert API',
      status: 'closed',
      priority: 5,
    });
  });
});
