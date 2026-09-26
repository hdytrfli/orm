import type { SchemaRelationMap, SchemaVirtualMap } from '../../relations/definitions.js';
import { normalizeProjectionFields } from '../projection/runtime.js';

type NestedProjectionSpec = { readonly ref: string } | { readonly virtual: string };

/** Use explicit selections when provided; otherwise omit hidden schema fields. */
export const selectedPopulationFields = (
  fields: readonly string[],
  hiddenFields: readonly string[],
  selectedFields?: readonly string[],
): readonly string[] => {
  if (selectedFields) return selectedFields;
  const hidden = new Set(hiddenFields);
  return fields.filter((field) => !hidden.has(field));
};

/** Build a population projection, retaining keys needed by nested populations. */
export const populateProjectionFor = (
  selectedFields: readonly string[],
  shownFields: readonly string[] | undefined,
  nestedSpecs: readonly NestedProjectionSpec[],
  relations: SchemaRelationMap,
  virtuals: SchemaVirtualMap,
): Record<string, 1> => {
  const fields = [...selectedFields];
  for (const nested of nestedSpecs) {
    if ('ref' in nested) {
      const relation = relations[nested.ref];
      if (relation) fields.push(relation.localField);
    } else {
      const virtual = virtuals[nested.virtual];
      if (virtual) fields.push(virtual.local);
    }
  }
  fields.push(...(shownFields ?? []));

  return Object.fromEntries(normalizeProjectionFields(fields).map((field) => [field, 1])) as Record<
    string,
    1
  >;
};
