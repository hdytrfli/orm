import type { AggregateOptions, Document } from 'mongodb';
import { describe, expect, it, vi } from 'vitest';

import type { Db } from '../../src/connection/database.js';
import { orm } from '../../src/index.js';
import { prepareAggregatePipeline } from '../../src/model/aggregate.js';
import { Model } from '../../src/model/model.js';
import { InvalidQueryError } from '../../src/validation/errors.js';

describe('aggregate pipeline preparation', () => {
  it('adds the active-document filter before ordinary pipeline stages', () => {
    const pipeline = [{ $group: { _id: '$status' } }];

    expect(prepareAggregatePipeline(pipeline, true)).toEqual([
      { $match: { deletedAt: null } },
      ...pipeline,
    ]);
  });

  it('combines a typed user filter with the default soft-delete filter', () => {
    const pipeline = [{ $group: { _id: '$status' } }];

    expect(prepareAggregatePipeline(pipeline, true, false, { status: 'done' })).toEqual([
      { $match: { $and: [{ status: 'done' }, { deletedAt: null }] } },
      ...pipeline,
    ]);
  });

  it.each(['$geoNear', '$search', '$vectorSearch'])(
    'keeps %s as the first pipeline stage',
    (stageName) => {
      const pipeline = [{ [stageName]: {} }, { $count: 'total' }];

      expect(prepareAggregatePipeline(pipeline, true)).toEqual([
        pipeline[0],
        { $match: { deletedAt: null } },
        pipeline[1],
      ]);
    },
  );

  it('does not add soft-delete filtering when disabled or explicitly included', () => {
    const pipeline = [{ $count: 'total' }];

    expect(prepareAggregatePipeline(pipeline, false)).toEqual(pipeline);
    expect(prepareAggregatePipeline(pipeline, true, true)).toEqual(pipeline);
  });

  it.each([
    '$changeStream',
    '$collStats',
    '$documents',
    '$indexStats',
    '$planCacheStats',
    '$searchMeta',
  ])('rejects %s when it cannot safely filter model documents', (stageName) => {
    expect(() => prepareAggregatePipeline([{ [stageName]: {} }], true)).toThrow(InvalidQueryError);
    expect(prepareAggregatePipeline([{ [stageName]: {} }], true, true)).toEqual([
      { [stageName]: {} },
    ]);
  });

  it('does not mutate the caller pipeline', () => {
    const pipeline = [{ $count: 'total' }];

    prepareAggregatePipeline(pipeline, true);

    expect(pipeline).toEqual([{ $count: 'total' }]);
  });
});

describe('model aggregate', () => {
  it('is lazy, then resolves results while forwarding driver options and soft-delete filtering', async () => {
    const documents = [{ status: 'done' }];
    const cursor = {
      toArray: vi.fn<() => Promise<unknown[]>>().mockResolvedValue(documents),
    };
    const aggregate = vi
      .fn<(pipeline: Document[], options: AggregateOptions) => unknown>()
      .mockReturnValue(cursor);
    const database = {
      native: { collection: () => ({ aggregate }) },
    } as unknown as Db;
    const schema = orm.schema({ status: orm.string() }).options({ softdelete: true });
    const tasks = new Model(database, 'tasks', schema);

    const query = tasks.aggregate<{ status: string }>([{ $project: { status: 1 } }], {
      allowDiskUse: true,
    });

    expect(aggregate).not.toHaveBeenCalled();
    await expect(query).resolves.toEqual(documents);
    expect(aggregate).toHaveBeenCalledWith(
      [{ $match: { deletedAt: null } }, { $project: { status: 1 } }],
      { allowDiskUse: true },
    );
  });

  it('keeps an explicit filter when deleted documents are included', () => {
    const pipeline = [{ $count: 'total' }];

    expect(prepareAggregatePipeline(pipeline, true, true, { status: 'done' })).toEqual([
      { $match: { status: 'done' } },
      ...pipeline,
    ]);
  });

  it('strips the ORM-only option when deleted documents are explicitly included', async () => {
    const aggregate = vi
      .fn<(pipeline: Document[], options: AggregateOptions) => unknown>()
      .mockReturnValue({ toArray: () => Promise.resolve([]) });
    const database = {
      native: { collection: () => ({ aggregate }) },
    } as unknown as Db;
    const schema = orm.schema({ status: orm.string() }).options({ softdelete: true });
    const tasks = new Model(database, 'tasks', schema);

    const query = tasks.aggregate<{ total: number }>([{ $count: 'total' }], {
      includeDeleted: true,
      allowDiskUse: true,
    });
    await query;

    expect(aggregate).toHaveBeenCalledWith([{ $count: 'total' }], { allowDiskUse: true });
  });

  it('supports streaming without materializing the result array', async () => {
    const cursor = {
      toArray: vi.fn<() => Promise<unknown[]>>(),
      async *[Symbol.asyncIterator]() {
        yield { status: 'done' };
      },
    };
    const aggregate = vi
      .fn<(pipeline: Document[], options: AggregateOptions) => unknown>()
      .mockReturnValue(cursor);
    const database = {
      native: { collection: () => ({ aggregate }) },
    } as unknown as Db;
    const schema = orm.schema({ status: orm.string() });
    const tasks = new Model(database, 'tasks', schema);
    const streamed: { status: string }[] = [];

    for await (const document of tasks.aggregate<{ status: string }>([])) {
      streamed.push(document);
    }

    expect(streamed).toEqual([{ status: 'done' }]);
    expect(cursor.toArray).not.toHaveBeenCalled();
  });
});
