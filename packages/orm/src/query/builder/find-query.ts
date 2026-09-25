import { ObjectId, type Collection } from 'mongodb';

import type { Db } from '../../connection/database.js';
import type { SchemaRelationMap, SchemaShape, ScopeDefinitions } from '../../schema/index.js';
import { InvalidQueryError } from '../../validation/errors.js';
import type { ModelCursor } from '../cursor/cursor.js';
import { PopulationExecutor } from '../population/executor.js';
import { SoftDeleteState } from '../soft-delete/state.js';
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
} from '../types.js';
import {
  countQuery,
  createCursorPage,
  executeFirst,
  executeQuery,
  type QueryExecutionContext,
} from './executor.js';

/** Makes invalid population-mode transitions explain themselves in editor errors. */
type QueryModeDiagnostic<Message extends string> = {
  readonly __mongorm_query_error__: Message;
};

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
} from '../types.js';

export { ModelCursor } from '../cursor/cursor.js';

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

  private executionContext(): QueryExecutionContext<Shape, Relations> {
    const context = {
      collection: this.collection,
      filter: this.filterSpec,
      effectiveFilter: this.effectiveFilter(),
      fields: this.fields,
      hiddenFields: this.hiddenFields,
      selectedFields: this.selectedFields,
      shownFields: this.shownFields,
      sortSpec: this.sortSpec,
      skipCount: this.skipCount,
      limitCount: this.limitCount,
      softDelete: this.softDelete,
      population: this.population,
      populateSpecs: this.populateSpecs,
    };
    Object.defineProperties(context, {
      effectiveFilter: { get: () => this.effectiveFilter() },
      selectedFields: { get: () => this.selectedFields },
      shownFields: { get: () => this.shownFields },
      sortSpec: { get: () => this.sortSpec },
      skipCount: { get: () => this.skipCount },
      limitCount: { get: () => this.limitCount },
      softDelete: { get: () => this.softDelete },
      populateSpecs: { get: () => this.populateSpecs },
    });
    return context;
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
    specs: Specs &
      (Mode extends 'scope'
        ? QueryModeDiagnostic<'Cannot call populate() after with(); choose one population mode.'>
        : unknown),
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
    name: Name &
      (Mode extends 'populate'
        ? QueryModeDiagnostic<'Cannot call with() after populate(); choose one population mode.'>
        : unknown),
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
  count(estimate = false): Promise<number> {
    return countQuery(this.executionContext(), estimate);
  }

  /** Stream all matches, or return one bounded `_id`-ordered page when a limit is set. */
  private createCursor(after?: ObjectId): ModelCursor<Shape, Result> {
    return createCursorPage(this.executionContext(), after);
  }

  private execute(): Promise<Result[]> {
    return executeQuery(this.executionContext());
  }

  first(): Promise<Result | null> {
    return executeFirst(this.executionContext());
  }

  then<TResult1 = Result[], TResult2 = never>(
    onfulfilled?: ((value: Result[]) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
