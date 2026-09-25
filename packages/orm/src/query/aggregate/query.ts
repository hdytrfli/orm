import type { AggregationCursor, Document } from 'mongodb';

/** Lazy aggregate results that can be awaited as an array or consumed as a stream. */
export interface AggregateQuery<Result extends Document>
  extends PromiseLike<Result[]>, AsyncIterable<Result> {}

class AggregateQueryImpl<Result extends Document> implements AggregateQuery<Result> {
  constructor(private readonly openCursor: () => AggregationCursor<Result>) {}

  then<TResult1 = Result[], TResult2 = never>(
    onfulfilled?: ((value: Result[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.openCursor().toArray().then(onfulfilled, onrejected);
  }

  [Symbol.asyncIterator](): AsyncIterator<Result> {
    return this.openCursor()[Symbol.asyncIterator]();
  }
}

/** Create a lazy aggregate query from a factory that opens a fresh driver cursor. */
export const createAggregateQuery = <Result extends Document>(
  openCursor: () => AggregationCursor<Result>,
): AggregateQuery<Result> => new AggregateQueryImpl(openCursor);
