import { ObjectId } from 'mongodb';
import { z } from 'zod';

import type { SchemaShape } from './contracts.js';

/** A schema-like target resolved lazily to support circular module imports. */
export type SchemaLike = import('./schema.js').Schema<SchemaShape>;

/** Metadata attached to a forward relation field. */
export interface RefDefinition<Target extends SchemaLike = SchemaLike> {
  /** Resolve the related schema after module initialization completes. */
  resolve: () => Target;
}

/** A string identifier field carrying a typed relation target. */
export type RefField<Target extends SchemaLike = SchemaLike> = z.ZodType<ObjectId> & {
  readonly __ref?: RefDefinition<Target>;
};

/** The relation metadata inferred from a schema shape. */
export type RelationMap<Shape extends SchemaShape> = {
  [
    Key in keyof Shape as Shape[Key] extends { readonly __ref?: RefDefinition } ? Key : never
  ]: Shape[Key] extends { readonly __ref?: infer Definition } ? NonNullable<Definition> : never;
};

/** Create a string ID field linked to a lazily resolved target schema. */
export const createRef = <Target extends SchemaLike>(resolve: () => Target): RefField<Target> => {
  const field = z.instanceof(ObjectId) as RefField<Target>;
  Object.defineProperty(field, '__ref', {
    configurable: false,
    enumerable: false,
    value: { resolve },
  });
  return field;
};

/** Collect relation metadata from a schema shape without evaluating targets. */
export const collectRefs = <Shape extends SchemaShape>(shape: Shape): RelationMap<Shape> => {
  return Object.fromEntries(
    Object.entries(shape)
      .filter(([, field]) => '__ref' in field)
      .map(([name, field]) => [name, (field as RefField).__ref]),
  ) as unknown as RelationMap<Shape>;
};
