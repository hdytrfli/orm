import {
  type Collection,
  type Condition,
  type Document,
  type Filter as MongoFilter,
  type RootFilterOperators,
  type Sort,
} from 'mongodb';

import type { Infer, Schema, SchemaShape } from '../schema/index.js';

export type StoredDocument<Shape extends SchemaShape> = Infer<Schema<Shape>> & Document;

type ModelFilterForDocument<
  DocumentShape extends Document,
  FieldShape extends object = DocumentShape,
> = Partial<{
  [Key in keyof FieldShape]: Condition<FieldShape[Key]>;
}> &
  Partial<
    Pick<
      RootFilterOperators<DocumentShape>,
      '$comment' | '$expr' | '$jsonSchema' | '$text' | '$where'
    >
  > & {
    $and?: ModelFilterForDocument<DocumentShape, FieldShape>[];
    $nor?: ModelFilterForDocument<DocumentShape, FieldShape>[];
    $or?: ModelFilterForDocument<DocumentShape, FieldShape>[];
  };

export type ModelFilter<Shape extends SchemaShape> = ModelFilterForDocument<
  StoredDocument<Shape>,
  Infer<Schema<Shape>>
>;

type SortDirection = 'asc' | 'desc';
export type ModelSort<Shape extends SchemaShape> = Partial<
  Record<Extract<keyof Infer<Schema<Shape>>, string>, SortDirection>
>;

/** A typed, awaitable MongoDB find query. */
export class ModelQuery<Shape extends SchemaShape> implements PromiseLike<Infer<Schema<Shape>>[]> {
  private sortSpec: ModelSort<Shape> | undefined;
  private skipCount: number | undefined;
  private limitCount: number | undefined;

  constructor(
    private readonly collection: Collection<StoredDocument<Shape>>,
    private readonly filterSpec: ModelFilter<Shape>,
  ) {}

  /** Sort results by one or more schema fields. */
  sort(spec: ModelSort<Shape>): this {
    this.sortSpec = spec;
    return this;
  }

  /** Skip a non-negative number of matching documents. */
  skip(count: number): this {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('Query skip must be a non-negative integer');
    }
    this.skipCount = count;
    return this;
  }

  /** Limit the number of matching documents returned. */
  limit(count: number): this {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('Query limit must be a non-negative integer');
    }
    this.limitCount = count;
    return this;
  }

  private execute(): Promise<Infer<Schema<Shape>>[]> {
    let cursor = this.collection.find(this.filterSpec as MongoFilter<StoredDocument<Shape>>);
    if (this.sortSpec) {
      cursor = cursor.sort(this.sortSpec as Sort);
    }
    if (this.skipCount !== undefined) {
      cursor = cursor.skip(this.skipCount);
    }
    if (this.limitCount !== undefined) {
      cursor = cursor.limit(this.limitCount);
    }
    return cursor.toArray() as unknown as Promise<Infer<Schema<Shape>>[]>;
  }

  then<TResult1 = Infer<Schema<Shape>>[], TResult2 = never>(
    onfulfilled?: ((value: Infer<Schema<Shape>>[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
