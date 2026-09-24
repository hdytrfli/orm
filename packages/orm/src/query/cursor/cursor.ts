import { ObjectId, type FindCursor, type WithId } from 'mongodb';

import type { SchemaShape } from '../../schema/contracts.js';
import type { StoredDocument } from '../types.js';

/** A lazy async iterable for one cursor-pagination page. */
export class ModelCursor<
  Shape extends SchemaShape,
  Result extends object,
> implements AsyncIterable<Result> {
  next: ObjectId | null = null;

  constructor(
    private readonly open: () => FindCursor<WithId<StoredDocument<Shape>>>,
    private readonly pageSize: number,
    private readonly transform?: (documents: Result[]) => Promise<Result[]>,
  ) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<Result> {
    const cursor = this.open();
    try {
      const documents: Result[] = [];
      for (let index = 0; index < this.pageSize && (await cursor.hasNext()); index += 1) {
        documents.push((await cursor.next()) as unknown as Result);
      }
      const transformed = this.transform ? await this.transform(documents) : documents;
      for (const document of transformed) {
        yield document;
      }
      const last = transformed.at(-1) as (Result & { _id: ObjectId }) | undefined;
      this.next = (await cursor.hasNext()) && last ? last._id : null;
    } finally {
      await cursor.close();
    }
  }
}
