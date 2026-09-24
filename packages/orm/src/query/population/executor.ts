import type { Db } from '../../connection/database.js';
import type { SchemaRelationMap } from '../../relations/definitions.js';
import { normalizeProjectionFields } from '../projection/runtime.js';

export type RuntimePopulateSpec = {
  ref: string;
  select?: readonly string[];
  populate?: readonly RuntimePopulateSpec[];
};

/** Executes already-validated population instructions against related collections. */
export class PopulationExecutor<Relations extends SchemaRelationMap> {
  constructor(
    private readonly db: Db,
    private readonly relations: Relations,
  ) {}

  async apply<Result extends object>(
    documents: Result[],
    specs: readonly RuntimePopulateSpec[],
  ): Promise<Result[]> {
    await Promise.all(
      documents.map(async (document) => {
        for (const spec of specs) {
          await this.populateDocument(document as Record<string, unknown>, spec, this.relations);
        }
      }),
    );
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
