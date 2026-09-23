import { ObjectId, type FindCursor, type WithId } from 'mongodb';

import type { SchemaShape } from '../schema/contracts.js';
import type { StoredDocument } from './types.js';

/** A lazy async iterable for one cursor-pagination page. */
export class ModelCursor<
  Shape extends SchemaShape,
  Result extends object,
> implements AsyncIterable<Result> {
  next: ObjectId | null = null;

  constructor(
    private readonly open: () => FindCursor<WithId<StoredDocument<Shape>>>,
    private readonly pageSize: number,
  ) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<Result> {
    const cursor = this.open();
    let last: (Result & { _id: ObjectId }) | undefined;
    try {
      for (let index = 0; index < this.pageSize && (await cursor.hasNext()); index += 1) {
        const document = (await cursor.next()) as unknown as Result & { _id: ObjectId };
        last = document;
        yield document as Result;
      }
      this.next = (await cursor.hasNext()) && last ? last._id : null;
    } finally {
      await cursor.close();
    }
  }
}
