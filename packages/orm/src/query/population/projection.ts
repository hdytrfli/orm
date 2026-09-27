import type { SchemaRelationMap, SchemaVirtualMap } from '../../relations/definitions.js';
import { normalizeProjectionFields, resolveFieldSelection } from '../projection/runtime.js';

type NestedProjectionSpec = { readonly ref: string } | { readonly virtual: string };

/** Build a population projection while retaining keys needed by nested populations. */
export const populateProjectionFor = (
  schemaFields: readonly string[],
  hiddenSchemaFields: readonly string[],
  selection: readonly string[] | undefined,
  nestedSpecs: readonly NestedProjectionSpec[],
  relations: SchemaRelationMap,
  virtuals: SchemaVirtualMap,
): Record<string, 1> => {
  const resolved = resolveFieldSelection(schemaFields, hiddenSchemaFields, selection);
  const fields = ['_id', ...resolved.visibleFields, ...resolved.includedHiddenFields];
  for (const nested of nestedSpecs) {
    if ('ref' in nested) {
      const relation = relations[nested.ref];
      if (relation) fields.push(relation.localField);
    } else {
      const virtual = virtuals[nested.virtual];
      if (virtual) fields.push(virtual.local);
    }
  }
  return Object.fromEntries(normalizeProjectionFields(fields).map((field) => [field, 1])) as Record<
    string,
    1
  >;
};
