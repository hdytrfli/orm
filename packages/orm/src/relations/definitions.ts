import { ObjectId } from 'mongodb';
import { z } from 'zod';

import type { SchemaShape } from '../schema/contracts.js';
import type { SchemaIndex } from '../schema/schema.js';

/** A schema-like target resolved lazily to support circular module imports. */
export type SchemaLike = import('../schema/schema.js').Schema<
  SchemaShape,
  any,
  any,
  any,
  readonly SchemaIndex<any>[]
>;

/** Metadata attached to a forward relation field. */
export interface RefDefinition<Target extends SchemaLike = SchemaLike> {
  /** Resolve the related schema after module initialization completes. */
  resolve: () => Target;
}

/** Metadata for a one-way relation between two MongoDB schemas. */
export interface SchemaRelation<
  Target extends SchemaLike = SchemaLike,
  LocalField extends string = string,
  ForeignField extends string = string,
> {
  readonly resolve: () => Target;
  readonly localField: LocalField;
  readonly foreignField: ForeignField;
}

/** Relation metadata attached to a schema. */
export type SchemaRelationMap = Record<string, SchemaRelation>;

/** A relation target declaration accepted by Schema.relations(). */
export type RelationInput<Target extends SchemaLike = SchemaLike> =
  | (() => Target)
  | {
      target: () => Target;
      foreignField?: string;
    };

/** Extract a relation target from a relation declaration. */
export type RelationInputTarget<Input> = Input extends () => infer Target
  ? Target
  : Input extends { target: () => infer Target }
    ? Target
    : never;

/** A string identifier field carrying a typed relation target. */
export type RefField<Target extends SchemaLike = SchemaLike> = z.ZodType<ObjectId> & {
  readonly __ref?: RefDefinition<Target>;
  optional(): OptionalRefField<Target>;
  nullable(): NullableRefField<Target>;
  nullish(): NullishRefField<Target>;
};

/** An optional relation field that retains its target metadata. */
export type OptionalRefField<Target extends SchemaLike = SchemaLike> = z.ZodOptional<
  RefField<Target>
> & {
  readonly __ref?: RefDefinition<Target>;
};

/** A nullable relation field that retains its target metadata. */
export type NullableRefField<Target extends SchemaLike = SchemaLike> = z.ZodNullable<
  RefField<Target>
> & {
  readonly __ref?: RefDefinition<Target>;
};

/** An optional and nullable relation field that retains its target metadata. */
export type NullishRefField<Target extends SchemaLike = SchemaLike> = z.ZodOptional<
  NullableRefField<Target>
> & {
  readonly __ref?: RefDefinition<Target>;
};

type RelationDefinition<Field> = Field extends { readonly __ref?: infer Definition }
  ? NonNullable<Definition>
  : Field extends z.ZodOptional<infer Inner>
    ? RelationDefinition<Inner>
    : Field extends z.ZodNullable<infer Inner>
      ? RelationDefinition<Inner>
      : never;

/** The relation metadata inferred from a schema shape. */
export type RelationMap<Shape extends SchemaShape> = {
  [
    Key in keyof Shape as RelationDefinition<Shape[Key]> extends never ? never : Key
  ]: RelationDefinition<Shape[Key]>;
};

/** Create a string ID field linked to a lazily resolved target schema. */
export const createRef = <Target extends SchemaLike>(resolve: () => Target): RefField<Target> => {
  const field = z.instanceof(ObjectId) as RefField<Target>;
  const createOptional = field.optional.bind(field);
  const createNullable = field.nullable.bind(field);
  const createNullish = field.nullish.bind(field);
  Object.defineProperty(field, '__ref', {
    configurable: false,
    enumerable: false,
    value: { resolve },
  });
  Object.defineProperty(field, 'optional', {
    configurable: false,
    enumerable: false,
    value: () => attachRef(createOptional(), resolve) as OptionalRefField<Target>,
  });
  Object.defineProperty(field, 'nullable', {
    configurable: false,
    enumerable: false,
    value: () => attachRef(createNullable(), resolve),
  });
  Object.defineProperty(field, 'nullish', {
    configurable: false,
    enumerable: false,
    value: () => attachRef(createNullish(), resolve),
  });
  return field;
};

const attachRef = <Field extends z.ZodType, Target extends SchemaLike>(
  field: Field,
  resolve: () => Target,
): Field & { readonly __ref?: RefDefinition<Target> } => {
  Object.defineProperty(field, '__ref', {
    configurable: false,
    enumerable: false,
    value: { resolve },
  });
  return field as Field & { readonly __ref?: RefDefinition<Target> };
};

/** Collect relation metadata from a schema shape without evaluating targets. */
export const collectRefs = <Shape extends SchemaShape>(shape: Shape): RelationMap<Shape> => {
  return Object.fromEntries(
    Object.entries(shape)
      .filter(([, field]) => '__ref' in field)
      .map(([name, field]) => [name, (field as RefField).__ref]),
  ) as unknown as RelationMap<Shape>;
};
