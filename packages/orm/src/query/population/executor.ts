import type { Db } from '../../connection/database.js';
import type { SchemaRelationMap, SchemaVirtualMap } from '../../relations/definitions.js';
import type { VirtualAggregate } from '../../relations/definitions.js';
import {
  populateProjectionFor,
  selectedPopulationFields,
  shownPopulationFields,
} from './projection.js';

export type RuntimePopulateSpec =
  | {
      ref: string;
      fields?: readonly string[];
      populate?: readonly RuntimePopulateSpec[];
    }
  | {
      virtual: string;
      type: 'many' | 'first';
      aggregate?: VirtualAggregate;
      fields?: readonly string[];
    };

const valueAtPath = (document: Record<string, unknown>, path: string): unknown =>
  path.split('.').reduce<unknown>((value, segment) => {
    if (value === null || typeof value !== 'object') return undefined;
    return (value as Record<string, unknown>)[segment];
  }, document);

const setValueAtPath = (document: Record<string, unknown>, path: string, value: unknown): void => {
  const segments = path.split('.');
  const property = segments.pop();
  if (!property) return;

  let parent = document;
  for (const segment of segments) {
    const nested = parent[segment];
    if (nested === null || typeof nested !== 'object') parent[segment] = {};
    parent = parent[segment] as Record<string, unknown>;
  }
  parent[property] = value;
};

/** Executes already-validated population instructions against related collections. */
export class PopulationExecutor<Relations extends SchemaRelationMap> {
  constructor(
    private readonly db: Db,
    private readonly relations: Relations,
    private readonly virtuals: SchemaVirtualMap,
  ) {}

  async apply<Result extends object>(
    documents: Result[],
    specs: readonly RuntimePopulateSpec[],
  ): Promise<Result[]> {
    const populateDocument = async (document: Result) => {
      for (const spec of specs) {
        await this.populateDocument(document as Record<string, unknown>, spec, this.relations);
      }
    };
    await Promise.all(documents.map(populateDocument));
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
    virtuals: SchemaVirtualMap = this.virtuals,
  ): Promise<void> {
    if ('virtual' in spec) {
      const virtual = virtuals[spec.virtual];
      if (!virtual) return;
      const aggregate = spec.aggregate;
      const target = virtual.resolve();
      const virtualOptions = spec;
      const localValue = valueAtPath(document, virtual.local);
      if (localValue === undefined || localValue === null) {
        const aggregateValue = aggregate
          ? aggregate.type === 'count' || aggregate.type === 'sum'
            ? 0
            : null
          : undefined;
        setValueAtPath(
          document,
          spec.virtual,
          aggregate ? aggregateValue : spec.type === 'first' ? null : [],
        );
        return;
      }

      const projection = populateProjectionFor(
        selectedPopulationFields(target.fields, target.hiddenFields, virtualOptions.fields),
        shownPopulationFields(virtualOptions.fields),
        [],
        target.relationMap as SchemaRelationMap,
        target.virtualMap as SchemaVirtualMap,
      );
      const foreignValue = Array.isArray(localValue) ? { $in: localValue } : localValue;
      const joinFilter = { [virtual.foreign]: foreignValue };
      const filter = joinFilter;
      const collection = this.db.collectionFor(target);
      if (aggregate) {
        const operation =
          aggregate.type === 'count'
            ? '$sum'
            : `$${aggregate.type === 'average' ? 'avg' : aggregate.type}`;
        const expression =
          aggregate.type === 'count'
            ? { $cond: [{ $ne: [`$${aggregate.field}`, null] }, 1, 0] }
            : `$${aggregate.field}`;
        const [result] = await collection
          .aggregate<{ value: number | null }>([
            { $match: filter },
            { $group: { _id: null, value: { [operation]: expression } } },
          ])
          .toArray();
        const value =
          result?.value ?? (aggregate.type === 'count' || aggregate.type === 'sum' ? 0 : null);
        setValueAtPath(document, spec.virtual, value);
        return;
      }
      if (spec.type === 'first') {
        const first = await collection.findOne(filter, { projection });
        setValueAtPath(document, spec.virtual, first);
        return;
      }
      const related = await collection.find(filter, { projection }).toArray();
      setValueAtPath(document, spec.virtual, related);
      return;
    }

    const relation = relations[spec.ref];
    const target = relation.resolve();
    const value = valueAtPath(document, relation.localField);
    const targetRelations = target.relationMap as SchemaRelationMap;
    const selectedFields = selectedPopulationFields(
      target.fields,
      target.hiddenFields,
      spec.fields,
    );
    const nestedSpecs = spec.populate ?? [];
    const projection = populateProjectionFor(
      selectedFields,
      shownPopulationFields(spec.fields),
      nestedSpecs,
      targetRelations,
      target.virtualMap as SchemaVirtualMap,
    );
    const related = value
      ? await this.db
          .collectionFor(target)
          .findOne({ [relation.foreignField]: value }, { projection })
      : null;
    if (!related) {
      setValueAtPath(document, spec.ref, null);
      return;
    }

    for (const nested of nestedSpecs) {
      const nestedVirtuals = target.virtualMap as SchemaVirtualMap;
      await this.populateDocument(related, nested, targetRelations, nestedVirtuals);
    }
    setValueAtPath(document, spec.ref, related);
  }
}
