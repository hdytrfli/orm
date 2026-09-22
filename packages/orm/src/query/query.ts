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
type ModelDocument<Shape extends SchemaShape> = Infer<Schema<Shape>>;
type SelectableKey<Shape extends SchemaShape> = Extract<keyof ModelDocument<Shape>, string>;
type SelectedDocument<Shape extends SchemaShape, Key extends SelectableKey<Shape>> = Pick<
  ModelDocument<Shape>,
  Key | '_id'
>;

/** A typed, awaitable MongoDB find query. */
export class ModelQuery<
  Shape extends SchemaShape,
  Result extends object = ModelDocument<Shape>,
> implements PromiseLike<Result[]> {
  private sortSpec: ModelSort<Shape> | undefined;
  private skipCount: number | undefined;
  private limitCount: number | undefined;
  private selectSpec: Record<string, 1> | undefined;

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

  /** Return only selected fields, while retaining MongoDB's default `_id`. */
  select<Keys extends SelectableKey<Shape>>(
    fields: readonly Keys[],
  ): ModelQuery<Shape, SelectedDocument<Shape, Keys>> {
    this.selectSpec = Object.fromEntries(fields.map((field) => [field, 1]));
    return this as unknown as ModelQuery<Shape, SelectedDocument<Shape, Keys>>;
  }

  /** Count matching documents, optionally using MongoDB's collection estimate. */
  async count(estimate = false): Promise<number> {
    if (estimate) {
      if (Object.keys(this.filterSpec).length > 0) {
        throw new Error('Estimated query counts do not support filters');
      }
      return this.collection.estimatedDocumentCount();
    }
    return this.collection.countDocuments(this.filterSpec as MongoFilter<StoredDocument<Shape>>);
  }

  private execute(): Promise<Result[]> {
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
    if (this.selectSpec) {
      cursor = cursor.project(this.selectSpec);
    }
    return cursor.toArray() as unknown as Promise<Result[]>;
  }

  then<TResult1 = Result[], TResult2 = never>(
    onfulfilled?: ((value: Result[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}

/** A typed, awaitable MongoDB single-document query. */
export class ModelFindQuery<
  Shape extends SchemaShape,
  Result extends object = ModelDocument<Shape>,
> implements PromiseLike<Result | null> {
  private selectSpec: Record<string, 1> | undefined;

  constructor(
    private readonly collection: Collection<StoredDocument<Shape>>,
    private readonly filterSpec: ModelFilter<Shape>,
  ) {}

  /** Return only selected fields, while retaining MongoDB's default `_id`. */
  select<Keys extends SelectableKey<Shape>>(
    fields: readonly Keys[],
  ): ModelFindQuery<Shape, SelectedDocument<Shape, Keys>> {
    this.selectSpec = Object.fromEntries(fields.map((field) => [field, 1]));
    return this as unknown as ModelFindQuery<Shape, SelectedDocument<Shape, Keys>>;
  }

  private execute(): Promise<Result | null> {
    return this.collection.findOne(this.filterSpec as MongoFilter<StoredDocument<Shape>>, {
      projection: this.selectSpec,
    }) as unknown as Promise<Result | null>;
  }

  then<TResult1 = Result | null, TResult2 = never>(
    onfulfilled?: ((value: Result | null) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
