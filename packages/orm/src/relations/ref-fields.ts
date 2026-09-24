import { ObjectId } from 'mongodb';
import { z } from 'zod';

import type { SchemaShape } from '../schema/contracts.js';
import type { RefDefinition, SchemaLike } from './definitions.js';

/** ObjectId Zod field carrying a lazily resolved relation target. */
export type RefField<Target extends SchemaLike = SchemaLike> = z.ZodType<ObjectId> & {
  readonly __ref?: RefDefinition<Target>;
  optional(): OptionalRefField<Target>;
  nullable(): NullableRefField<Target>;
  nullish(): NullishRefField<Target>;
};

export type OptionalRefField<Target extends SchemaLike = SchemaLike> = z.ZodOptional<
  RefField<Target>
> & {
  readonly __ref?: RefDefinition<Target>;
};

export type NullableRefField<Target extends SchemaLike = SchemaLike> = z.ZodNullable<
  RefField<Target>
> & {
  readonly __ref?: RefDefinition<Target>;
};

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

/** Relation fields inferred from a schema shape. */
export type RelationMap<Shape extends SchemaShape> = {
  [
    Key in keyof Shape as RelationDefinition<Shape[Key]> extends never ? never : Key
  ]: RelationDefinition<Shape[Key]>;
};

/** Create a typed ObjectId field linked to a lazily resolved schema. */
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

/** Collect ref field metadata without evaluating target schemas. */
export const collectRefs = <Shape extends SchemaShape>(shape: Shape): RelationMap<Shape> =>
  Object.fromEntries(
    Object.entries(shape)
      .filter(([, field]) => '__ref' in field)
      .map(([name, field]) => [name, (field as RefField).__ref]),
  ) as unknown as RelationMap<Shape>;
