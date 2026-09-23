import { type Collection, type Filter as MongoFilter } from 'mongodb';

import type { Db } from '../connection/database.js';
import type { SchemaRelationMap, SchemaShape, ScopeDefinitions } from '../schema/index.js';
import { InvalidQueryError } from '../validation/errors.js';
import { PopulationExecutor, projectionFor, SoftDeleteState } from './runtime.js';
import type {
  HiddenDocumentKey,
  ModelDocument,
  ModelFilter,
  PopulateSpecs,
  PopulatedResult,
  PopulationMode,
  ScopeName,
  SelectedDocument,
  SelectableKey,
  StoredDocument,
  VisibleDocument,
} from './types.js';

/** A typed, awaitable MongoDB single-document query. */
export class ModelFindQuery<
  Shape extends SchemaShape,
  Result extends object = VisibleDocument<Shape>,
  Relations extends SchemaRelationMap = {},
  Scopes extends ScopeDefinitions = {},
  Mode extends PopulationMode = 'none',
  SoftDelete extends boolean = false,
> implements PromiseLike<Result | null> {
  declare readonly all: SoftDelete extends true ? () => this : never;
  declare readonly deleted: SoftDelete extends true ? () => this : never;
  private selectedFields: readonly string[] | undefined;
  private shownFields: readonly string[] = [];
  private populateSpecs: PopulateSpecs<Relations> = [];
  private populationMode: PopulationMode = 'none';
  private readonly softDelete: SoftDeleteState<Shape>;
  private readonly population: PopulationExecutor<Relations>;

  constructor(
    private readonly collection: Collection<StoredDocument<Shape>>,
    private readonly filterSpec: ModelFilter<Shape>,
    private readonly fields: readonly string[],
    private readonly hiddenFields: readonly string[],
    db: Db,
    relations: Relations,
    private readonly scopes: Scopes,
    softdeleteEnabled: boolean,
  ) {
    this.softDelete = new SoftDeleteState(softdeleteEnabled);
    this.population = new PopulationExecutor(db, relations);
    if (softdeleteEnabled) {
      Object.defineProperties(this, {
        all: { configurable: false, enumerable: false, value: () => this.includeDeleted() },
        deleted: { configurable: false, enumerable: false, value: () => this.filterDeleted() },
      });
    }
  }

  private includeDeleted(): this {
    this.softDelete.includeDeleted();
    return this;
  }

  private filterDeleted(): this {
    this.softDelete.deleted();
    return this;
  }

  private effectiveFilter(): ModelFilter<Shape> {
    return this.softDelete.effectiveFilter(this.filterSpec);
  }

  select<Keys extends SelectableKey<Shape> = never>(
    fields: readonly Keys[] = [],
  ): ModelFindQuery<Shape, SelectedDocument<Shape, Keys>, Relations, Scopes, Mode, SoftDelete> {
    this.selectedFields = fields;
    return this as unknown as ModelFindQuery<
      Shape,
      SelectedDocument<Shape, Keys>,
      Relations,
      Scopes,
      Mode,
      SoftDelete
    >;
  }

  show<Keys extends HiddenDocumentKey<Shape>>(
    fields: readonly Keys[],
  ): ModelFindQuery<
    Shape,
    Result & Pick<ModelDocument<Shape>, Keys>,
    Relations,
    Scopes,
    Mode,
    SoftDelete
  > {
    this.shownFields = fields;
    return this as unknown as ModelFindQuery<
      Shape,
      Result & Pick<ModelDocument<Shape>, Keys>,
      Relations,
      Scopes,
      Mode,
      SoftDelete
    >;
  }

  populate<Specs extends PopulateSpecs<Relations>>(
    this: Mode extends 'scope'
      ? never
      : ModelFindQuery<Shape, Result, Relations, Scopes, Mode, SoftDelete>,
    specs: Specs,
  ): ModelFindQuery<
    Shape,
    PopulatedResult<Result, Relations, Specs>,
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
    return this as unknown as ModelFindQuery<
      Shape,
      PopulatedResult<Result, Relations, Specs>,
      Relations,
      Scopes,
      'populate',
      SoftDelete
    >;
  }

  with<Name extends ScopeName<Scopes>>(
    this: Mode extends 'populate'
      ? never
      : ModelFindQuery<Shape, Result, Relations, Scopes, Mode, SoftDelete>,
    name: Name,
  ): ModelFindQuery<
    Shape,
    PopulatedResult<Result, Relations, Scopes[Name] & PopulateSpecs<Relations>>,
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
    return this as unknown as ModelFindQuery<
      Shape,
      PopulatedResult<Result, Relations, Scopes[Name] & PopulateSpecs<Relations>>,
      Relations,
      Scopes,
      'scope',
      SoftDelete
    >;
  }

  private execute(): Promise<Result | null> {
    const projection = projectionFor(
      this.fields,
      this.hiddenFields,
      this.selectedFields,
      this.shownFields,
    );
    return this.collection
      .findOne(
        this.effectiveFilter() as MongoFilter<StoredDocument<Shape>>,
        projection ? { projection } : undefined,
      )
      .then(async (document) => {
        if (!document) return null;
        return this.population.applyOne(document as unknown as Result, this.populateSpecs);
      });
  }

  then<TResult1 = Result | null, TResult2 = never>(
    onfulfilled?: ((value: Result | null) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
