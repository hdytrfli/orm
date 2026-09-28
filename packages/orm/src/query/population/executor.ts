import type { Db } from '../../connection/database.js';
import type { SchemaRelationMap, SchemaVirtualMap } from '../../relations/definitions.js';
import { populateProjectionFor } from './projection.js';

export type RuntimePopulateSpec = {
  ref: string;
  fields?: readonly string[];
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

  private async populateDocument(
    document: Record<string, unknown>,
    spec: RuntimePopulateSpec,
    relations: SchemaRelationMap,
    virtuals: SchemaVirtualMap = this.virtuals,
  ): Promise<void> {
    const binding = virtuals[spec.ref];
    if (binding) {
      const target = this.db.schemaFor(binding.ref);
      const aggregate =
        binding.kind === 'count' ||
        binding.kind === 'distinct' ||
        binding.kind === 'sum' ||
        binding.kind === 'avg' ||
        binding.kind === 'min' ||
        binding.kind === 'max' ||
        binding.kind === 'median';
      const joinFilter = { [binding.via]: valueAtPath(document, '_id') };
      const collection = this.db.collectionFor(target);
      if (aggregate && binding.kind === 'count') {
        const countFilter = {
          ...joinFilter,
          [binding.field!]: {
            $exists: true,
            $ne: null,
          },
        };
        setValueAtPath(document, spec.ref, await collection.countDocuments(countFilter));
        return;
      }
      const projection = populateProjectionFor(
        target.fields,
        target.hiddenFields,
        spec.fields,
        [],
        target.relationMap as SchemaRelationMap,
      );
      if (aggregate) {
        if (binding.kind === 'distinct') {
          const [result] = await collection
            .aggregate<{ value: number }>([
              {
                $match: {
                  ...joinFilter,
                  [binding.field!]: {
                    $exists: true,
                    $ne: null,
                  },
                },
              },
              {
                $group: {
                  _id: `$${binding.field}`,
                },
              },
              {
                $count: 'value',
              },
            ])
            .toArray();
          setValueAtPath(document, spec.ref, result?.value ?? 0);
          return;
        }

        const accumulator =
          binding.kind === 'median'
            ? {
                $median: {
                  input: `$${binding.field}`,
                  method: 'approximate',
                },
              }
            : { [`$${binding.kind}`]: `$${binding.field}` };
        const [result] = await collection
          .aggregate<{ value: number | null }>([
            { $match: joinFilter },
            { $group: { _id: null, value: accumulator } },
          ])
          .toArray();
        const value = result?.value ?? (binding.kind === 'sum' ? 0 : null);
        setValueAtPath(document, spec.ref, value);
        return;
      }
      if (binding.kind === 'first') {
        const first = await collection.findOne(joinFilter, { projection });
        setValueAtPath(document, spec.ref, first);
        return;
      }
      const related = await collection.find(joinFilter, { projection }).toArray();
      setValueAtPath(document, spec.ref, related);
      return;
    }

    const relation = relations[spec.ref];
    const target = relation.resolve();
    const value = valueAtPath(document, relation.localField);
    const targetRelations = target.relationMap as SchemaRelationMap;
    const nestedSpecs = spec.populate ?? [];
    const projection = populateProjectionFor(
      target.fields,
      target.hiddenFields,
      spec.fields,
      nestedSpecs,
      targetRelations,
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
