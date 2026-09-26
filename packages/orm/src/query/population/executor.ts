import type { Db } from '../../connection/database.js';
import type { SchemaRelationMap, SchemaVirtualMap } from '../../relations/definitions.js';
import { populateProjectionFor } from './projection.js';

export type RuntimePopulateSpec =
  | {
      ref: string;
      select?: readonly string[];
      show?: readonly string[];
      populate?: readonly RuntimePopulateSpec[];
    }
  | {
      virtual: string;
      select?: readonly string[];
      show?: readonly string[];
      populate?: readonly RuntimePopulateSpec[];
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
      const target = virtual.resolve();
      const localValue = valueAtPath(document, virtual.localField);
      const nestedSpecs = spec.populate ?? [];
      if (localValue === undefined || localValue === null) {
        setValueAtPath(document, spec.virtual, []);
        return;
      }

      const nestedRelations = target.relationMap as SchemaRelationMap;
      const nestedVirtuals = target.virtualMap as SchemaVirtualMap;
      const projection = populateProjectionFor(
        spec.select ?? target.fields,
        spec.show,
        nestedSpecs,
        nestedRelations,
        nestedVirtuals,
      );
      const foreignValue = Array.isArray(localValue) ? { $in: localValue } : localValue;
      const related = await this.db
        .collectionFor(target)
        .find({ [virtual.foreignField]: foreignValue }, { projection })
        .toArray();
      for (const relatedDocument of related) {
        for (const nested of nestedSpecs) {
          await this.populateDocument(relatedDocument, nested, nestedRelations, nestedVirtuals);
        }
      }
      setValueAtPath(document, spec.virtual, related);
      return;
    }

    const relation = relations[spec.ref];
    const target = relation.resolve();
    const value = valueAtPath(document, relation.localField);
    const targetRelations = target.relationMap as SchemaRelationMap;
    const hiddenTargetFields = new Set(target.hiddenFields);
    const selectedFields =
      spec.select ?? target.fields.filter((field) => !hiddenTargetFields.has(field));
    const nestedSpecs = spec.populate ?? [];
    const projection = populateProjectionFor(
      selectedFields,
      spec.show,
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
