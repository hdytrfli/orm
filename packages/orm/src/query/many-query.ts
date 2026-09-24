import { ObjectId, type Collection, type Filter as MongoFilter, type Sort } from 'mongodb';

import type { Db } from '../connection/database.js';
import type { SchemaRelationMap, SchemaShape, ScopeDefinitions } from '../schema/index.js';
import { CursorQueryError, EstimatedCountError, InvalidQueryError } from '../validation/errors.js';
import { ModelCursor } from './cursor.js';
import {
  createCursorFilter,
  PopulationExecutor,
  projectionFor,
  SoftDeleteState,
} from './runtime.js';
import type {
  CursorMethod,
  HiddenDocumentKey,
  ModelFilter,
  ModelSort,
  ModelDocument,
  PopulateSpecs,
  PopulatedResult,
  PopulationMode,
  ScopeName,
  SelectedDocument,
  SelectableKey,
  StoredDocument,
  VisibleDocument,
} from './types.js';

type ScopeResult<
  Result extends object,
  Relations extends SchemaRelationMap,
  Scopes extends ScopeDefinitions,
  Name extends ScopeName<Scopes>,
> = PopulatedResult<Result, Relations, Extract<Scopes[Name], PopulateSpecs<Relations>>>;

export type {
  ModelFilter,
  ModelSort,
  PopulateSpec,
  PopulateSpecs,
  PopulatedResult,
  SelectedDocument,
  SelectableKey,
  StoredDocument,
  VisibleDocument,
} from './types.js';

export { ModelCursor } from './cursor.js';

/** A typed, awaitable MongoDB find query. */
export class ModelQuery<
  Shape extends SchemaShape,
  Result extends object = VisibleDocument<Shape>,
  CursorReady extends boolean = true,
  Relations extends SchemaRelationMap = {},
  Scopes extends ScopeDefinitions = {},
  Mode extends PopulationMode = 'none',
  SoftDelete extends boolean = false,
> implements PromiseLike<Result[]> {
  declare readonly deleted: SoftDelete extends true ? (mode: 'only' | 'include') => this : never;
  private sortSpec: ModelSort<Shape> | undefined;
  private skipCount: number | undefined;
  private limitCount: number | undefined;
  private selectedFields: readonly string[] | undefined;
  private shownFields: readonly string[] = [];
  private populateSpecs: PopulateSpecs<Relations> = [];
  private populationMode: PopulationMode = 'none';
  private readonly softDelete: SoftDeleteState<Shape>;
  private readonly population: PopulationExecutor<Relations>;
  readonly cursor = ((after?: ObjectId) => this.createCursor(after)) as CursorMethod<
    Shape,
    Result,
    CursorReady
  >;

  constructor(
    private readonly collection: Collection<StoredDocument<Shape>>,
    private readonly filterSpec: ModelFilter<Shape>,
    private readonly fields: readonly string[],
    private readonly hiddenFields: readonly string[],
    private readonly db: Db,
    private readonly relations: Relations,
    private readonly scopes: Scopes,
    private readonly softdeleteEnabled: boolean,
  ) {
    this.softDelete = new SoftDeleteState(softdeleteEnabled);
    this.population = new PopulationExecutor(db, relations);
    if (softdeleteEnabled) {
      Object.defineProperties(this, {
        deleted: {
          configurable: false,
          enumerable: false,
          value: (mode: 'only' | 'include') => this.deletedMode(mode),
        },
      });
    }
  }

  /** Include both active and soft-deleted documents in this query. */
  private deletedMode(mode: 'only' | 'include'): this {
    this.softDelete.deleted(mode);
    return this;
  }

  private effectiveFilter(): ModelFilter<Shape> {
    return this.softDelete.effectiveFilter(this.filterSpec);
  }

  /** Sort results by one or more schema fields. */
  sort(
    spec: ModelSort<Shape>,
  ): ModelQuery<Shape, Result, false, Relations, Scopes, Mode, SoftDelete> {
    this.sortSpec = spec;
    return this as unknown as ModelQuery<Shape, Result, false, Relations, Scopes, Mode, SoftDelete>;
  }

  /** Skip a non-negative number of matching documents. */
  skip(count: number): ModelQuery<Shape, Result, false, Relations, Scopes, Mode, SoftDelete> {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('Query skip must be a non-negative integer');
    }
    this.skipCount = count;
    return this as unknown as ModelQuery<Shape, Result, false, Relations, Scopes, Mode, SoftDelete>;
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
  ): ModelQuery<
    Shape,
    SelectedDocument<Shape, Keys>,
    CursorReady,
    Relations,
    Scopes,
    Mode,
    SoftDelete
  > {
    this.selectedFields = fields;
    return this as unknown as ModelQuery<
      Shape,
      SelectedDocument<Shape, Keys>,
      CursorReady,
      Relations,
      Scopes,
      Mode,
      SoftDelete
    >;
  }

  /** Include hidden fields in the query result. */
  show<Keys extends HiddenDocumentKey<Shape>>(
    fields: readonly Keys[],
  ): ModelQuery<
    Shape,
    Result & Pick<ModelDocument<Shape>, Keys>,
    CursorReady,
    Relations,
    Scopes,
    Mode,
    SoftDelete
  > {
    this.shownFields = fields;
    return this as unknown as ModelQuery<
      Shape,
      Result & Pick<ModelDocument<Shape>, Keys>,
      CursorReady,
      Relations,
      Scopes,
      Mode,
      SoftDelete
    >;
  }

  /** Populate declared one-way relations, including nested relation arrays. */
  populate<Specs extends PopulateSpecs<Relations>>(
    this: Mode extends 'scope'
      ? never
      : ModelQuery<Shape, Result, CursorReady, Relations, Scopes, Mode, SoftDelete>,
    specs: Specs,
  ): ModelQuery<
    Shape,
    PopulatedResult<Result, Relations, Specs>,
    CursorReady,
    Relations,
    Scopes,
    'populate',
    SoftDelete
  > {
    if (this.populationMode === 'scope') {
      throw new InvalidQueryError(
        'A query cannot combine a population scope with explicit population',
      );
    }
    this.populationMode = 'populate';
    this.populateSpecs = specs;
    return this as unknown as ModelQuery<
      Shape,
      PopulatedResult<Result, Relations, Specs>,
      CursorReady,
      Relations,
      Scopes,
      'populate',
      SoftDelete
    >;
  }

  /** Apply a named population scope. */
  with<Name extends ScopeName<Scopes>>(
    this: Mode extends 'populate'
      ? never
      : ModelQuery<Shape, Result, CursorReady, Relations, Scopes, Mode, SoftDelete>,
    name: Name,
  ): ModelQuery<
    Shape,
    ScopeResult<Result, Relations, Scopes, Name>,
    CursorReady,
    Relations,
    Scopes,
    'scope',
    SoftDelete
  > {
    if (this.populationMode === 'populate') {
      throw new InvalidQueryError(
        'A query cannot combine explicit population with a population scope',
      );
    }
    this.populationMode = 'scope';
    this.populateSpecs = this.scopes[name] as PopulateSpecs<Relations>;
    return this as unknown as ModelQuery<
      Shape,
      ScopeResult<Result, Relations, Scopes, Name>,
      CursorReady,
      Relations,
      Scopes,
      'scope',
      SoftDelete
    >;
  }

  /** Count matching documents, optionally using MongoDB's collection estimate. */
  async count(estimate = false): Promise<number> {
    if (estimate) {
      if (Object.keys(this.filterSpec).length > 0 || this.softDelete.isFiltered()) {
        throw new EstimatedCountError();
      }
      return this.collection.estimatedDocumentCount();
    }
    return this.collection.countDocuments(
      this.effectiveFilter() as MongoFilter<StoredDocument<Shape>>,
    );
  }

  /** Return one `_id`-ordered page and the cursor for the next page. */
  private createCursor(after?: ObjectId): ModelCursor<Shape, Result> {
    if (this.limitCount === undefined || this.limitCount === 0) {
      throw new CursorQueryError('Cursor queries require a positive limit');
    }
    if (this.skipCount !== undefined) {
      throw new CursorQueryError('Cursor queries do not support skip');
    }
    if (this.sortSpec) {
      const keys = Object.keys(this.sortSpec);
      if (keys.length !== 1 || this.sortSpec._id !== 'asc') {
        throw new CursorQueryError('Cursor queries require the default _id ascending sort');
      }
    }

    const filter = createCursorFilter(this.effectiveFilter(), after);
    return new ModelCursor<Shape, Result>(
      () => {
        let cursor = this.collection
          .find(filter as MongoFilter<StoredDocument<Shape>>)
          .sort({ _id: 1 })
          .limit((this.limitCount as number) + 1);
        const projection = projectionFor(
          this.fields,
          this.hiddenFields,
          this.selectedFields,
          this.shownFields,
        );
        if (projection) {
          cursor = cursor.project(projection);
        }
        return cursor;
      },
      this.limitCount,
      (documents) => this.population.apply(documents, this.populateSpecs),
    );
  }

  private execute(): Promise<Result[]> {
    return this.createQueryCursor()
      .toArray()
      .then((documents) =>
        this.population.apply(documents as unknown as Result[], this.populateSpecs),
      );
  }

  async first(): Promise<Result | null> {
    const documents = await this.createQueryCursor().limit(1).toArray();
    const populated = await this.population.apply(
      documents as unknown as Result[],
      this.populateSpecs,
    );
    return populated[0] ?? null;
  }

  private createQueryCursor() {
    let cursor = this.collection.find(this.effectiveFilter() as MongoFilter<StoredDocument<Shape>>);
    if (this.sortSpec) {
      cursor = cursor.sort(this.sortSpec as Sort);
    }
    if (this.skipCount !== undefined) {
      cursor = cursor.skip(this.skipCount);
    }
    if (this.limitCount !== undefined) {
      cursor = cursor.limit(this.limitCount);
    }
    const projection = projectionFor(
      this.fields,
      this.hiddenFields,
      this.selectedFields,
      this.shownFields,
    );
    if (projection) {
      cursor = cursor.project(projection);
    }
    return cursor;
  }

  then<TResult1 = Result[], TResult2 = never>(
    onfulfilled?: ((value: Result[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
