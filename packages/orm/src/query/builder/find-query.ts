import { ObjectId, type Collection } from 'mongodb';

import type { Db } from '../../connection/database.js';
import type {
  SchemaRelationMap,
  SchemaShape,
  SchemaVirtualMap,
  ScopeDefinitions,
} from '../../schema/index.js';
import { InvalidQueryError } from '../../validation/errors.js';
import type { ModelCursor } from '../cursor/cursor.js';
import { PopulationExecutor } from '../population/executor.js';
import { SoftDeleteState } from '../soft-delete/state.js';
import type {
  CursorMethod,
  ModelFilter,
  ModelSort,
  PopulateSpecs,
  PopulateSpecsOnly,
  VirtualSpecs,
  ValidateVirtualSpecs,
  ValidatePopulateSpecs,
  PopulatedResult,
  PopulationMode,
  ScopeName,
  FieldSelection,
  FieldsDocument,
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
  Virtuals extends SchemaVirtualMap,
> = PopulatedResult<
  Result,
  Relations,
  Extract<Scopes[Name], PopulateSpecs<Relations, Virtuals>>,
  Virtuals
>;

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
  Virtuals extends SchemaVirtualMap = {},
> implements PromiseLike<Result[]> {
  declare readonly deleted: SoftDelete extends true ? (mode: 'only' | 'include') => this : never;
  private sortSpec: ModelSort<Shape> | undefined;
  private skipCount: number | undefined;
  private limitCount: number | undefined;
  private fieldSelection: readonly string[] | undefined;
  private populateSpecs: PopulateSpecs<Relations, Virtuals> = [];
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
    private readonly schemaFields: readonly string[],
    private readonly hiddenSchemaFields: readonly string[],
    db: Db,
    relations: Relations,
    private readonly scopes: Scopes,
    virtuals: Virtuals,
    softdeleteEnabled: boolean,
  ) {
    this.softDelete = new SoftDeleteState(softdeleteEnabled);
    this.population = new PopulationExecutor(db, relations, virtuals);
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
    const getEffectiveFilter = () => this.effectiveFilter();
    const getFieldSelection = () => this.fieldSelection;
    const getSortSpec = () => this.sortSpec;
    const getSkipCount = () => this.skipCount;
    const getLimitCount = () => this.limitCount;
    const getPopulateSpecs = () => this.populateSpecs;
    return {
      collection: this.collection,
      filter: this.filterSpec,
      get effectiveFilter() {
        return getEffectiveFilter();
      },
      fields: this.schemaFields,
      hiddenFields: this.hiddenSchemaFields,
      get fieldSelection() {
        return getFieldSelection();
      },
      get sortSpec() {
        return getSortSpec();
      },
      get skipCount() {
        return getSkipCount();
      },
      get limitCount() {
        return getLimitCount();
      },
      softDelete: this.softDelete,
      population: this.population,
      get populateSpecs() {
        return getPopulateSpecs();
      },
    };
  }

  /** Sort results by one or more schema fields. */
  sort(
    spec: ModelSort<Shape>,
  ): ModelQuery<Shape, Result, false, Relations, Scopes, Mode, SoftDelete, Virtuals> {
    this.sortSpec = spec;
    return this as unknown as ModelQuery<
      Shape,
      Result,
      false,
      Relations,
      Scopes,
      Mode,
      SoftDelete,
      Virtuals
    >;
  }

  /** Skip a non-negative number of matching documents. */
  skip(
    count: number,
  ): ModelQuery<Shape, Result, false, Relations, Scopes, Mode, SoftDelete, Virtuals> {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('Query skip must be a non-negative integer');
    }
    this.skipCount = count;
    return this as unknown as ModelQuery<
      Shape,
      Result,
      false,
      Relations,
      Scopes,
      Mode,
      SoftDelete,
      Virtuals
    >;
  }

  /** Limit the number of matching documents returned. */
  limit(count: number): this {
    if (!Number.isInteger(count) || count < 0) {
      throw new RangeError('Query limit must be a non-negative integer');
    }
    this.limitCount = count;
    return this;
  }

  /** Select visible and hidden fields with schema-checked selectors. */
  fields<const Selection extends readonly FieldSelection<Shape>[]>(
    fields: Selection,
  ): ModelQuery<
    Shape,
    FieldsDocument<Shape, Selection>,
    CursorReady,
    Relations,
    Scopes,
    Mode,
    SoftDelete,
    Virtuals
  > {
    this.fieldSelection = fields;
    return this as unknown as ModelQuery<
      Shape,
      FieldsDocument<Shape, Selection>,
      CursorReady,
      Relations,
      Scopes,
      Mode,
      SoftDelete,
      Virtuals
    >;
  }

  /** Populate declared one-way relations, including nested relation arrays. */
  populate<const Specs extends PopulateSpecsOnly<Relations>>(
    specs: Specs &
      ValidatePopulateSpecs<Specs, Relations> &
      (Mode extends 'scope' | 'virtual'
        ? QueryModeDiagnostic<'Cannot call populate() after virtual() or with(); choose one population mode.'>
        : unknown),
  ): ModelQuery<
    Shape,
    PopulatedResult<Result, Relations, Specs, Virtuals>,
    CursorReady,
    Relations,
    Scopes,
    'populate',
    SoftDelete,
    Virtuals
  > {
    if (this.populationMode === 'scope' || this.populationMode === 'virtual') {
      throw new InvalidQueryError(
        'A query cannot combine explicit population with another population mode',
      );
    }
    this.populationMode = 'populate';
    this.populateSpecs = specs as PopulateSpecs<Relations, Virtuals>;
    return this as unknown as ModelQuery<
      Shape,
      PopulatedResult<Result, Relations, Specs, Virtuals>,
      CursorReady,
      Relations,
      Scopes,
      'populate',
      SoftDelete,
      Virtuals
    >;
  }

  /** Load schema-declared virtual fields. */
  virtual<const Specs extends VirtualSpecs<Virtuals>>(
    specs: Specs & VirtualSpecs<Virtuals>,
    ..._validation: [Specs] extends [ValidateVirtualSpecs<Specs>]
      ? Mode extends 'scope' | 'populate'
        ? [
            QueryModeDiagnostic<'Cannot call virtual() after populate() or with(); choose one population mode.'>,
          ]
        : []
      : [never]
  ): ModelQuery<
    Shape,
    PopulatedResult<Result, Relations, Specs, Virtuals>,
    CursorReady,
    Relations,
    Scopes,
    'virtual',
    SoftDelete,
    Virtuals
  > {
    if (this.populationMode === 'scope' || this.populationMode === 'populate') {
      throw new InvalidQueryError(
        'A query cannot combine virtual loading with another population mode',
      );
    }
    this.populationMode = 'virtual';
    this.populateSpecs = specs as unknown as PopulateSpecs<Relations, Virtuals>;
    return this as unknown as ModelQuery<
      Shape,
      PopulatedResult<Result, Relations, Specs, Virtuals>,
      CursorReady,
      Relations,
      Scopes,
      'virtual',
      SoftDelete,
      Virtuals
    >;
  }

  /** Apply a named population scope. */
  with<Name extends ScopeName<Scopes>>(
    name: Name &
      (Mode extends 'populate' | 'virtual'
        ? QueryModeDiagnostic<'Cannot call with() after populate(); choose one population mode.'>
        : unknown),
  ): ModelQuery<
    Shape,
    ScopeResult<Result, Relations, Scopes, Name, Virtuals>,
    CursorReady,
    Relations,
    Scopes,
    'scope',
    SoftDelete,
    Virtuals
  > {
    if (this.populationMode === 'populate' || this.populationMode === 'virtual') {
      throw new InvalidQueryError(
        'A query cannot combine explicit population with a population scope',
      );
    }
    this.populationMode = 'scope';
    this.populateSpecs = this.scopes[name] as PopulateSpecs<Relations, Virtuals>;
    return this as unknown as ModelQuery<
      Shape,
      ScopeResult<Result, Relations, Scopes, Name, Virtuals>,
      CursorReady,
      Relations,
      Scopes,
      'scope',
      SoftDelete,
      Virtuals
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
