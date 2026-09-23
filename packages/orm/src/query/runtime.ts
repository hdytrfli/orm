import type { Collection, Filter, ObjectId } from 'mongodb';

import type { Db } from '../connection/database.js';
import type { SchemaRelationMap, SchemaShape } from '../schema/index.js';
import type { ModelFilter, StoredDocument } from './types.js';

export type RuntimePopulateSpec = {
  ref: string;
  select?: readonly string[];
  populate?: readonly RuntimePopulateSpec[];
};

export type DeletedMode = 'active' | 'all' | 'deleted';

export const normalizeProjectionFields = (fields: readonly string[]): string[] => {
  const unique = new Set(fields);
  return [...unique].filter((field) => {
    let separator = field.indexOf('.');
    while (separator !== -1) {
      if (unique.has(field.slice(0, separator))) return false;
      separator = field.indexOf('.', separator + 1);
    }
    return true;
  });
};

export const projectionFor = (
  fields: readonly string[],
  hiddenFields: readonly string[],
  selectedFields: readonly string[] | undefined,
  shownFields: readonly string[],
): Record<string, 1> | undefined => {
  const effectiveSelectedFields = selectedFields?.length ? selectedFields : undefined;
  if (!effectiveSelectedFields && hiddenFields.length === 0 && shownFields.length === 0) {
    return undefined;
  }
  const hidden = new Set(hiddenFields);
  const visibleFields = effectiveSelectedFields ?? fields.filter((field) => !hidden.has(field));
  return Object.fromEntries(
    normalizeProjectionFields([...visibleFields, ...shownFields]).map((field) => [field, 1]),
  );
};

export class SoftDeleteState<Shape extends SchemaShape> {
  private mode: DeletedMode = 'active';

  constructor(private readonly enabled: boolean) {}

  includeDeleted(): void {
    this.mode = 'all';
  }

  deleted(): void {
    this.mode = 'deleted';
  }

  isFiltered(): boolean {
    return this.enabled && this.mode !== 'all';
  }

  effectiveFilter(filter: ModelFilter<Shape>): ModelFilter<Shape> {
    if (!this.isFiltered()) return filter;
    const deletionFilter =
      this.mode === 'deleted' ? { deletedAt: { $ne: null } } : { deletedAt: null };
    return { $and: [deletionFilter, filter] } as ModelFilter<Shape>;
  }
}

export class PopulationExecutor<Relations extends SchemaRelationMap> {
  constructor(
    private readonly db: Db,
    private readonly relations: Relations,
  ) {}

  async apply<Result extends object>(
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

  async applyOne<Result extends object>(
    document: Result,
    specs: readonly RuntimePopulateSpec[],
  ): Promise<Result> {
    await this.apply([document], specs);
    return document;
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
    const hiddenTargetFields = new Set(target.hiddenFields);
    const projectionFields = normalizeProjectionFields([
      ...new Set(spec.select ?? target.fields.filter((field) => !hiddenTargetFields.has(field))),
      ...nestedRelationFields,
    ]);
    const related = value
      ? await this.db
          .collectionFor(target)
          .findOne(
            { [relation.foreignField]: value },
            { projection: Object.fromEntries(projectionFields.map((field) => [field, 1])) },
          )
      : null;
    if (related && spec.populate) {
      for (const nested of spec.populate) {
        await this.populateDocument(related, nested, targetRelations);
      }
    }
    document[spec.ref] = related;
  }
}

export const createCursorFilter = <Shape extends SchemaShape>(
  filter: ModelFilter<Shape>,
  after?: ObjectId,
): ModelFilter<Shape> =>
  (after ? { $and: [filter, { _id: { $gt: after } }] } : filter) as ModelFilter<Shape>;

export type QueryCollection<Shape extends SchemaShape> = Collection<StoredDocument<Shape>>;
export type MongoQueryFilter<Shape extends SchemaShape> = Filter<StoredDocument<Shape>>;
