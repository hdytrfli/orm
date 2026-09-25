import { ObjectId, type FindCursor, type WithId } from 'mongodb';

import type { SchemaShape } from '../../schema/contracts.js';
import type { StoredDocument } from '../types.js';

export const MODEL_CURSOR_BATCH_SIZE = 100;

/** A lazy async iterable for a full result stream or one cursor-pagination page. */
export class ModelCursor<
  Shape extends SchemaShape,
  Result extends object,
> implements AsyncIterable<Result> {
  next: ObjectId | null = null;

  constructor(
    private readonly open: () => FindCursor<WithId<StoredDocument<Shape>>>,
    private readonly pageSize: number | undefined,
    private readonly transform?: (documents: Result[]) => Promise<Result[]>,
  ) {}

  async *[Symbol.asyncIterator](): AsyncGenerator<Result> {
    const cursor = this.open();
    try {
      if (this.pageSize === undefined) {
        while (await cursor.hasNext()) {
          const documents: Result[] = [];
          while (documents.length < MODEL_CURSOR_BATCH_SIZE && (await cursor.hasNext())) {
            documents.push((await cursor.next()) as unknown as Result);
          }
          const transformed = this.transform ? await this.transform(documents) : documents;
          for (const document of transformed) yield document;
        }
        return;
      }

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
