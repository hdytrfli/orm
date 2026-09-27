/** Remove duplicate and ancestor-overlapping MongoDB projection paths. */
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

type ResolvedFieldSelection = {
  readonly visibleFields: readonly string[];
  readonly includedHiddenFields: readonly string[];
};

/** Resolve `$all`, explicit visible paths, and `+hiddenField` selectors. */
export const resolveFieldSelection = (
  fields: readonly string[],
  hiddenFields: readonly string[],
  selection?: readonly string[],
): ResolvedFieldSelection => {
  const hidden = new Set(hiddenFields);
  const visibleFields = selection?.includes('$all')
    ? fields.filter((field) => !hidden.has(field))
    : selection
      ? selection.filter((field) => field !== '$all' && !field.startsWith('+'))
      : fields.filter((field) => !hidden.has(field));

  return {
    visibleFields,
    includedHiddenFields:
      selection?.filter((field) => field.startsWith('+')).map((field) => field.slice(1)) ?? [],
  };
};

/** Build a MongoDB projection from schema visibility and unified field selectors. */
export const projectionFor = (
  fields: readonly string[],
  hiddenFields: readonly string[],
  selection?: readonly string[],
): Record<string, 1> | undefined => {
  if (selection === undefined && hiddenFields.length === 0) return undefined;
  const resolved = resolveFieldSelection(fields, hiddenFields, selection);
  return Object.fromEntries(
    normalizeProjectionFields([
      '_id',
      ...resolved.visibleFields,
      ...resolved.includedHiddenFields,
    ]).map((field) => [field, 1]),
  );
};
