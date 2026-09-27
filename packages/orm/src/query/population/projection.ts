import type { SchemaRelationMap, SchemaVirtualMap } from '../../relations/definitions.js';
import { normalizeProjectionFields } from '../projection/runtime.js';

type NestedProjectionSpec = { readonly ref: string } | { readonly virtual: string };

/** Resolve a `fields` selector into visible projection fields. `$all` means all public fields. */
export const selectedPopulationFields = (
  fields: readonly string[],
  hiddenFields: readonly string[],
  selection?: readonly string[],
): readonly string[] => {
  const hidden = new Set(hiddenFields);
  if (selection?.includes('$all')) return fields.filter((field) => !hidden.has(field));
  if (selection) return selection.filter((field) => field !== '$all' && !field.startsWith('+'));
  return fields.filter((field) => !hidden.has(field));
};

/** Resolve explicitly opted-in hidden fields from the same selector list. */
export const shownPopulationFields = (selection?: readonly string[]): readonly string[] =>
  selection?.filter((field) => field.startsWith('+')).map((field) => field.slice(1)) ?? [];

/** Build a population projection, retaining keys needed by nested populations. */
export const populateProjectionFor = (
  selectedFields: readonly string[],
  shownFields: readonly string[] | undefined,
  nestedSpecs: readonly NestedProjectionSpec[],
  relations: SchemaRelationMap,
  virtuals: SchemaVirtualMap,
): Record<string, 1> => {
  const fields = ['_id', ...selectedFields];
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
