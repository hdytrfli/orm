import {
  ObjectId,
  type Collection,
  type Condition,
  type Document,
  type Filter as MongoFilter,
  type RootFilterOperators,
  type Sort,
} from 'mongodb';

import type { Db } from '../connection/database.js';
import type {
  Infer,
  Schema,
  SchemaRelationMap,
  SchemaShape,
  ScopeDefinitions,
} from '../schema/index.js';
import { CursorQueryError, EstimatedCountError, InvalidQueryError } from '../validation/errors.js';
import { ModelCursor } from './cursor.js';
import type { CursorMethod } from './cursor.js';

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
type NestedDocumentKeys<Value, Prefix extends string = ''> = Value extends object
  ? Value extends ObjectId | Date
    ? never
    : {
        [Key in Extract<keyof Value, string>]: NonNullable<Value[Key]> extends object
          ? `${Prefix}${Key}` | `${Prefix}${Key}.${NestedDocumentKeys<NonNullable<Value[Key]>>}`
          : `${Prefix}${Key}`;
      }[Extract<keyof Value, string>]
  : never;
type NestedSelectableKey<Shape extends SchemaShape> = {
  [Key in Extract<keyof Shape, string>]: Key extends keyof ModelDocument<Shape>
    ? NonNullable<ModelDocument<Shape>[Key]> extends object
      ? `${Key}.${NestedDocumentKeys<NonNullable<ModelDocument<Shape>[Key]>>}`
      : never
    : never;
}[Extract<keyof Shape, string>];
type SelectableKey<Shape extends SchemaShape> =
  | Exclude<Extract<keyof ModelDocument<Shape>, string>, '_id' | HiddenDocumentKey<Shape>>
  | NestedSelectableKey<Shape>;
type PathSelection<Value, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof Value
    ? { [Key in Head]: PathSelection<NonNullable<Value[Key]>, Tail> }
    : never
  : Path extends keyof Value
    ? Pick<Value, Path>
    : never;
type UnionToIntersection<Value> = (Value extends unknown ? (input: Value) => void : never) extends (
  input: infer Intersection,
) => void
  ? Intersection
  : never;
type Simplify<Value> = { [Key in keyof Value]: Value[Key] };
export type VisibleDocument<Shape extends SchemaShape> = Omit<
  ModelDocument<Shape>,
  Extract<HiddenKey<Shape>, keyof ModelDocument<Shape>>
>;
type SelectedDocument<Shape extends SchemaShape, Key extends SelectableKey<Shape>> = [Key] extends [
  never,
]
  ? VisibleDocument<Shape>
  : Simplify<
      Pick<ModelDocument<Shape>, '_id'> &
        UnionToIntersection<PathSelection<ModelDocument<Shape>, Extract<Key, string>>>
    >;
type RelationTarget<Relation> = Relation extends { resolve: () => infer Target } ? Target : never;
type RelationDocument<Relation> =
  RelationTarget<Relation> extends Schema<infer TargetShape, any>
    ? Infer<Schema<TargetShape>>
    : never;
type RelationMapOf<Relation> =
  RelationTarget<Relation> extends { readonly relationMap: infer TargetRelations }
    ? TargetRelations extends SchemaRelationMap
      ? TargetRelations
      : {}
    : {};
type ScopeName<Scopes> = Extract<keyof Scopes, string>;
type PopulationMode = 'none' | 'populate' | 'scope';
type RelationSelect<Relation> =
  RelationTarget<Relation> extends Schema<infer TargetShape, any>
    ? Exclude<SelectableKey<TargetShape>, '_id'>
    : never;

export type PopulateSpec<Relations extends SchemaRelationMap> = {
  [Name in Extract<keyof Relations, string>]: {
    ref: Name;
    select?: readonly RelationSelect<Relations[Name]>[];
    populate?: PopulateSpecs<RelationMapOf<Relations[Name]>>;
  };
}[Extract<keyof Relations, string>];
export type PopulateSpecs<Relations extends SchemaRelationMap> = readonly PopulateSpec<Relations>[];
type RuntimePopulateSpec = {
  ref: string;
  select?: readonly string[];
  populate?: readonly RuntimePopulateSpec[];
};

const normalizeProjectionFields = (fields: readonly string[]): string[] => {
  const unique = [...new Set(fields)];
  return unique.filter(
    (field) => !unique.some((parent) => parent !== field && field.startsWith(`${parent}.`)),
  );
};
export type PopulatedResult<
  Result extends object,
  Relations extends SchemaRelationMap,
  Specs extends PopulateSpecs<Relations>,
> = Omit<Result, Extract<Specs[number]['ref'], keyof Result>> & {
  [Spec in Specs[number] as Spec['ref']]: PopulatedRelation<Relations[Spec['ref']], Spec> | null;
};

type PopulatedRelation<Relation, Spec> = Spec extends {
  populate: infer Nested extends PopulateSpecs<RelationMapOf<Relation>>;
}
  ? RelationDocument<Relation> extends infer Document extends object
    ? PopulatedResult<Document, RelationMapOf<Relation>, Nested>
    : never
  : RelationDocument<Relation>;

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
  declare readonly withDeleted: SoftDelete extends true ? () => this : never;
  declare readonly onlyDeleted: SoftDelete extends true ? () => this : never;
  private sortSpec: ModelSort<Shape> | undefined;
  private skipCount: number | undefined;
  private limitCount: number | undefined;
  private selectedFields: readonly string[] | undefined;
  private shownFields: readonly string[] = [];
  private populateSpecs: PopulateSpecs<Relations> = [];
  private populationMode: PopulationMode = 'none';
  private deletedMode: 'active' | 'all' | 'deleted' = 'active';
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
    if (softdeleteEnabled) {
      Object.defineProperties(this, {
        withDeleted: { configurable: false, enumerable: false, value: () => this.includeDeleted() },
        onlyDeleted: { configurable: false, enumerable: false, value: () => this.filterDeleted() },
      });
    }
  }

  /** Include both active and soft-deleted documents in this query. */
  private includeDeleted(): this {
    this.deletedMode = 'all';
    return this;
  }

  /** Restrict this query to soft-deleted documents. */
  private filterDeleted(): this {
    this.deletedMode = 'deleted';
    return this;
  }

  private effectiveFilter(): ModelFilter<Shape> {
    if (!this.softdeleteEnabled || this.deletedMode === 'all') return this.filterSpec;
    const deletionFilter =
      this.deletedMode === 'deleted' ? { deletedAt: { $ne: null } } : { deletedAt: null };
    return { $and: [deletionFilter, this.filterSpec] } as ModelFilter<Shape>;
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
    PopulatedResult<Result, Relations, Scopes[Name] & PopulateSpecs<Relations>>,
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
      PopulatedResult<Result, Relations, Scopes[Name] & PopulateSpecs<Relations>>,
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
      if (
        Object.keys(this.filterSpec).length > 0 ||
        (this.softdeleteEnabled && this.deletedMode !== 'all')
      ) {
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

    const baseFilter = this.effectiveFilter();
    const filter = after ? { $and: [baseFilter, { _id: { $gt: after } }] } : baseFilter;
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
        cursor = cursor.project(
          Object.fromEntries(normalizeProjectionFields([...fields]).map((field) => [field, 1])),
        );
      }
      return cursor;
    }, this.limitCount);
  }

  private execute(): Promise<Result[]> {
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
    if (this.selectedFields || this.hiddenFields.length > 0) {
      const fields = new Set(
        this.selectedFields ?? this.fields.filter((field) => !this.hiddenFields.includes(field)),
      );
      this.shownFields.forEach((field) => fields.add(field));
      const projection = Object.fromEntries(
        normalizeProjectionFields([...fields]).map((field) => [field, 1]),
      );
      cursor = cursor.project(projection);
    }
    return cursor
      .toArray()
      .then((documents) =>
        this.populateDocuments(documents as unknown as Result[], this.populateSpecs),
      );
  }

  private async populateDocuments(
    documents: Result[],
    specs: readonly RuntimePopulateSpec[],
  ): Promise<Result[]> {
    for (const document of documents) {
      for (const spec of specs) {
        await this.populateDocument(document as Record<string, unknown>, spec, this.relations);
      }
    }
    return documents;
  }

  private async populateDocument(
    document: Record<string, unknown>,
    spec: RuntimePopulateSpec,
    relations: SchemaRelationMap,
  ): Promise<void> {
    const relation = relations[spec.ref];
    const target = relation.resolve();
    const value = document[relation.localField];
    const targetRelations = target.relationMap as SchemaRelationMap;
    const nestedRelationFields = (spec.populate ?? []).map(
      (nested) => targetRelations[nested.ref].localField,
    );
    const projectionFields = normalizeProjectionFields([
      ...new Set(
        spec.select ?? target.fields.filter((field) => !target.hiddenFields.includes(field)),
      ),
      ...nestedRelationFields,
    ]);
    const related = value
      ? await this.db.collectionFor(target).findOne(
          { [relation.foreignField]: value },
          {
            projection: Object.fromEntries(
              normalizeProjectionFields(projectionFields).map((field) => [field, 1]),
            ),
          },
        )
      : null;
    if (related && spec.populate) {
      for (const nested of spec.populate) {
        await this.populateDocument(related, nested, targetRelations);
      }
    }
    document[spec.ref] = related;
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
  Relations extends SchemaRelationMap = {},
  Scopes extends ScopeDefinitions = {},
  Mode extends PopulationMode = 'none',
  SoftDelete extends boolean = false,
> implements PromiseLike<Result | null> {
  declare readonly withDeleted: SoftDelete extends true ? () => this : never;
  declare readonly onlyDeleted: SoftDelete extends true ? () => this : never;
  private selectedFields: readonly string[] | undefined;
  private shownFields: readonly string[] = [];
  private populateSpecs: PopulateSpecs<Relations> = [];
  private populationMode: PopulationMode = 'none';
  private deletedMode: 'active' | 'all' | 'deleted' = 'active';

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
    if (softdeleteEnabled) {
      Object.defineProperties(this, {
        withDeleted: { configurable: false, enumerable: false, value: () => this.includeDeleted() },
        onlyDeleted: { configurable: false, enumerable: false, value: () => this.filterDeleted() },
      });
    }
  }

  /** Include both active and soft-deleted documents in this query. */
  private includeDeleted(): this {
    this.deletedMode = 'all';
    return this;
  }

  /** Restrict this query to soft-deleted documents. */
  private filterDeleted(): this {
    this.deletedMode = 'deleted';
    return this;
  }

  private effectiveFilter(): ModelFilter<Shape> {
    if (!this.softdeleteEnabled || this.deletedMode === 'all') return this.filterSpec;
    const deletionFilter =
      this.deletedMode === 'deleted' ? { deletedAt: { $ne: null } } : { deletedAt: null };
    return { $and: [deletionFilter, this.filterSpec] } as ModelFilter<Shape>;
  }

  /** Return only selected fields, while retaining MongoDB's default `_id`. */
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

  /** Include hidden fields in the query result. */
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

  /** Populate declared one-way relations, including nested relation arrays. */
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

  /** Apply a named population scope. */
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
    const options =
      this.selectedFields || this.hiddenFields.length > 0
        ? {
            projection: Object.fromEntries(
              normalizeProjectionFields([
                ...(this.selectedFields ??
                  this.fields.filter((field) => !this.hiddenFields.includes(field))),
                ...this.shownFields,
              ]).map((field) => [field, 1]),
            ),
          }
        : undefined;
    return this.collection
      .findOne(this.effectiveFilter() as MongoFilter<StoredDocument<Shape>>, options)
      .then(async (document) => {
        if (!document) return null;
        const result = document as unknown as Result;
        for (const spec of this.populateSpecs) {
          await this.populateDocument(result as Record<string, unknown>, spec, this.relations);
        }
        return result;
      }) as unknown as Promise<Result | null>;
  }

  private async populateDocument(
    document: Record<string, unknown>,
    spec: RuntimePopulateSpec,
    relations: SchemaRelationMap,
  ): Promise<void> {
    const relation = relations[spec.ref];
    const target = relation.resolve();
    const value = document[relation.localField];
    const targetRelations = target.relationMap as SchemaRelationMap;
    const nestedRelationFields = (spec.populate ?? []).map(
      (nested) => targetRelations[nested.ref].localField,
    );
    const projectionFields = normalizeProjectionFields([
      ...new Set(
        spec.select ?? target.fields.filter((field) => !target.hiddenFields.includes(field)),
      ),
      ...nestedRelationFields,
    ]);
    const related = value
      ? await this.db.collectionFor(target).findOne(
          { [relation.foreignField]: value },
          {
            projection: Object.fromEntries(
              normalizeProjectionFields(projectionFields).map((field) => [field, 1]),
            ),
          },
        )
      : null;
    if (related && spec.populate) {
      for (const nested of spec.populate) {
        await this.populateDocument(related, nested, targetRelations);
      }
    }
    document[spec.ref] = related;
  }

  then<TResult1 = Result | null, TResult2 = never>(
    onfulfilled?: ((value: Result | null) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return this.execute().then(onfulfilled, onrejected);
  }
}
