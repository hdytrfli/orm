import {
  ObjectId,
  type Collection,
  type Condition,
  type Document,
  type Filter as MongoFilter,
  type FindCursor,
  type RootFilterOperators,
  type Sort,
  type WithId,
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
type HiddenKey<Shape extends SchemaShape> = {
  [Key in keyof Shape]: Shape[Key] extends { readonly __hidden: true } ? Key : never;
}[keyof Shape];
type HiddenDocumentKey<Shape extends SchemaShape> = Extract<
  HiddenKey<Shape>,
  keyof ModelDocument<Shape>
> &
  string;
type SelectableKey<Shape extends SchemaShape> = Exclude<
  Extract<keyof ModelDocument<Shape>, string>,
  '_id' | HiddenDocumentKey<Shape>
>;
type VisibleDocument<Shape extends SchemaShape> = Omit<
  ModelDocument<Shape>,
  Extract<HiddenKey<Shape>, keyof ModelDocument<Shape>>
>;
type SelectedDocument<Shape extends SchemaShape, Key extends SelectableKey<Shape>> = [Key] extends [
  never,
]
  ? VisibleDocument<Shape>
  : Pick<ModelDocument<Shape>, Key | '_id'>;

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

/** A typed, awaitable MongoDB find query. */
export class ModelQuery<
  Shape extends SchemaShape,
  Result extends object = VisibleDocument<Shape>,
  CursorReady extends boolean = true,
> implements PromiseLike<Result[]> {
  private sortSpec: ModelSort<Shape> | undefined;
  private skipCount: number | undefined;
  private limitCount: number | undefined;
  private selectedFields: readonly string[] | undefined;
  private shownFields: readonly string[] = [];

  constructor(
    private readonly collection: Collection<StoredDocument<Shape>>,
    private readonly filterSpec: ModelFilter<Shape>,
    private readonly fields: readonly string[],
    private readonly hiddenFields: readonly string[],
  ) {}

  /** Sort results by one or more schema fields. */
  sort(spec: ModelSort<Shape>): ModelQuery<Shape, Result, false> {
    this.sortSpec = spec;
    return this as unknown as ModelQuery<Shape, Result, false>;
  }

  /** Skip a non-negative number of matching documents. */
  skip(count: number): ModelQuery<Shape, Result, false> {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('Query skip must be a non-negative integer');
    }
    this.skipCount = count;
    return this as unknown as ModelQuery<Shape, Result, false>;
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
  select<Keys extends SelectableKey<Shape> = never>(
    fields: readonly Keys[] = [],
  ): ModelQuery<Shape, SelectedDocument<Shape, Keys>, CursorReady> {
    this.selectedFields = fields;
    return this as unknown as ModelQuery<Shape, SelectedDocument<Shape, Keys>, CursorReady>;
  }

  /** Include hidden fields in the query result. */
  show<Keys extends HiddenDocumentKey<Shape>>(
    fields: readonly Keys[],
  ): ModelQuery<Shape, Result & Pick<ModelDocument<Shape>, Keys>, CursorReady> {
    this.shownFields = fields;
    return this as unknown as ModelQuery<
      Shape,
      Result & Pick<ModelDocument<Shape>, Keys>,
      CursorReady
    >;
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

  /** Return one `_id`-ordered page and the cursor for the next page. */
  cursor(
    this: CursorReady extends true ? ModelQuery<Shape, Result, CursorReady> : never,
    after?: ObjectId,
  ): ModelCursor<Shape, Result> {
    if (this.limitCount === undefined || this.limitCount === 0) {
      throw new Error('Cursor queries require a positive limit');
    }
    if (this.skipCount !== undefined) {
      throw new Error('Cursor queries do not support skip');
    }
    if (this.sortSpec) {
      const keys = Object.keys(this.sortSpec);
      if (keys.length !== 1 || this.sortSpec._id !== 'asc') {
        throw new Error('Cursor queries require the default _id ascending sort');
      }
    }

    const filter = after ? { $and: [this.filterSpec, { _id: { $gt: after } }] } : this.filterSpec;
    return new ModelCursor<Shape, Result>(() => {
      let cursor = this.collection
        .find(filter as MongoFilter<StoredDocument<Shape>>)
        .sort({ _id: 1 })
        .limit((this.limitCount as number) + 1);
      if (this.selectedFields || this.hiddenFields.length > 0) {
        const fields = new Set(
          this.selectedFields ?? this.fields.filter((field) => !this.hiddenFields.includes(field)),
        );
        this.shownFields.forEach((field) => fields.add(field));
        cursor = cursor.project(Object.fromEntries([...fields].map((field) => [field, 1])));
      }
      return cursor;
    }, this.limitCount);
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
    if (this.selectedFields || this.hiddenFields.length > 0) {
      const fields = new Set(
        this.selectedFields ?? this.fields.filter((field) => !this.hiddenFields.includes(field)),
      );
      this.shownFields.forEach((field) => fields.add(field));
      const projection = Object.fromEntries([...fields].map((field) => [field, 1]));
      cursor = cursor.project(projection);
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
  Result extends object = VisibleDocument<Shape>,
> implements PromiseLike<Result | null> {
  private selectedFields: readonly string[] | undefined;
  private shownFields: readonly string[] = [];

  constructor(
    private readonly collection: Collection<StoredDocument<Shape>>,
    private readonly filterSpec: ModelFilter<Shape>,
    private readonly fields: readonly string[],
    private readonly hiddenFields: readonly string[],
  ) {}

  /** Return only selected fields, while retaining MongoDB's default `_id`. */
  select<Keys extends SelectableKey<Shape> = never>(
    fields: readonly Keys[] = [],
  ): ModelFindQuery<Shape, SelectedDocument<Shape, Keys>> {
    this.selectedFields = fields;
    return this as unknown as ModelFindQuery<Shape, SelectedDocument<Shape, Keys>>;
  }

  /** Include hidden fields in the query result. */
  show<Keys extends HiddenDocumentKey<Shape>>(
    fields: readonly Keys[],
  ): ModelFindQuery<Shape, Result & Pick<ModelDocument<Shape>, Keys>> {
    this.shownFields = fields;
    return this as unknown as ModelFindQuery<Shape, Result & Pick<ModelDocument<Shape>, Keys>>;
  }

  private execute(): Promise<Result | null> {
    const options =
      this.selectedFields || this.hiddenFields.length > 0
        ? {
            projection: Object.fromEntries(
              [
                ...(this.selectedFields ??
                  this.fields.filter((field) => !this.hiddenFields.includes(field))),
                ...this.shownFields,
              ].map((field) => [field, 1]),
            ),
          }
        : undefined;
    return this.collection.findOne(
      this.filterSpec as MongoFilter<StoredDocument<Shape>>,
      options,
    ) as unknown as Promise<Result | null>;
  }

  then<TResult1 = Result | null, TResult2 = never>(
    onfulfilled?: ((value: Result | null) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
