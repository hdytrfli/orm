/** Flatten mapped and intersection types to make editor hints easier to read. */
export type Simplify<Value> = { [Key in keyof Value]: Value[Key] };

/** Convert a union into an intersection when merging selected field paths. */
export type UnionToIntersection<Value> = (
  Value extends unknown ? (input: Value) => void : never
) extends (input: infer Intersection) => void
  ? Intersection
  : never;
