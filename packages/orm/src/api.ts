import { z } from 'zod';

import type { VirtualField, VirtualKind, VirtualPlaceholder } from './relations/definitions.js';
import type { SchemaLike } from './relations/definitions.js';
import { createSchemaRegistry } from './relations/registry.js';
import { coerceObjectId, objectId } from './schema/object-id.js';
import { Schema } from './schema/schema.js';
import { withZodNamespace } from './schema/zod-namespace.js';

type SchemaInput = Record<string, z.ZodType | VirtualField>;
type ActualShape<Input extends SchemaInput> = {
  [Key in keyof Input as Input[Key] extends VirtualField ? never : Key]: Extract<
    Input[Key],
    z.ZodType
  >;
};
type DeclaredVirtuals<Input extends SchemaInput> = {
  [
    Key in keyof Input as Input[Key] extends VirtualField ? Key : never
  ]: Input[Key] extends VirtualField<infer Kind> ? VirtualPlaceholder<Kind> : never;
};

type ZodConstructorKey = {
  [Key in keyof typeof z]: Key extends string
    ? Key extends Lowercase<Key>
      ? (typeof z)[Key] extends (...args: any[]) => any
        ? Key
        : never
      : never
    : never;
}[keyof typeof z];

type ZodConstructors = Pick<typeof z, ZodConstructorKey>;
type CoerceNamespace = typeof z.coerce & {
  stringbool: typeof z.stringbool;
  objectId: typeof coerceObjectId;
};

const isZodConstructor = ([name, value]: [string, unknown]): boolean => {
  return name === name.toLowerCase() && typeof value === 'function';
};

/** The public schema-construction API. */
export type OrmApi = ZodConstructors & {
  /** Define a typed object schema. */
  schema<const Input extends SchemaInput>(
    shape: Input,
  ): Schema<ActualShape<Input>, {}, {}, {}, [], DeclaredVirtuals<Input>>;
  /** Declare a non-persisted virtual result field. */
  virtual<Kind extends VirtualKind>(kind: Kind): VirtualField<Kind>;
  /** Build a registry of named schemas and their relation graph. */
  defineSchemas<const Registry extends Record<string, SchemaLike>>(
    registry: Registry,
  ): ReturnType<typeof createSchemaRegistry<Registry>>;
  /** Create a MongoDB ObjectId field. */
  objectId: typeof objectId;
  /** Zod coercing constructors; use stringbool for boolean strings. */
  coerce: CoerceNamespace;
};

/** The ORM schema API with the complete native Zod namespace. */
const zodEntries = Object.entries(z);
const constructorEntries = zodEntries.filter(isZodConstructor);
const zodConstructors = Object.fromEntries(constructorEntries) as ZodConstructors;
const coerceNamespace = withZodNamespace(
  Object.assign({}, z.coerce, { stringbool: z.stringbool, objectId: coerceObjectId }),
) as CoerceNamespace;

export const orm: OrmApi = Object.assign({}, withZodNamespace(zodConstructors), {
  schema: <const Input extends SchemaInput>(shape: Input) => {
    const actualShape: Record<string, z.ZodType> = {};
    const virtualDefinitions: Record<string, VirtualPlaceholder> = {};
    for (const [name, field] of Object.entries(shape)) {
      if ('__mongormVirtual' in field) virtualDefinitions[name] = { kind: field.__mongormVirtual };
      else actualShape[name] = field;
    }
    return new Schema(actualShape, {}, {}, {}, [], {}, virtualDefinitions) as unknown as Schema<
      ActualShape<Input>,
      {},
      {},
      {},
      [],
      DeclaredVirtuals<Input>
    >;
  },
  virtual: <Kind extends VirtualKind>(kind: Kind): VirtualField<Kind> => ({
    __mongormVirtual: kind,
  }),
  defineSchemas: createSchemaRegistry,
  objectId,
  coerce: coerceNamespace,
});
