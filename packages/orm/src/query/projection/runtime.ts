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

/** Build the MongoDB projection from schema visibility and query selections. */
export const projectionFor = (
  fields: readonly string[],
  hiddenFields: readonly string[],
  selectedFields: readonly string[] | undefined,
  shownFields: readonly string[],
): Record<string, 1> | undefined => {
  if (selectedFields === undefined && hiddenFields.length === 0 && shownFields.length === 0) {
    return undefined;
  }
  const hidden = new Set(hiddenFields);
  const visibleFields = selectedFields ?? fields.filter((field) => !hidden.has(field));
  return Object.fromEntries(
    normalizeProjectionFields(['_id', ...visibleFields, ...shownFields]).map((field) => [field, 1]),
  );
};
