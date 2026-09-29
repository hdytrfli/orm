import { ObjectId } from 'mongodb';
import { z } from 'zod';

import type { SchemaShape } from './contracts.js';

/** Field types used to build a composable coerced Zod object. */
export type CoercedSchemaShape<Shape extends SchemaShape> = {
  [Key in keyof Shape]: z.ZodType<z.output<Shape[Key]>, unknown>;
};

type RuntimeSchema = {
  readonly _def?: {
    readonly type?: string;
    readonly innerType?: RuntimeSchema;
    readonly element?: RuntimeSchema;
    readonly shape?: Record<string, RuntimeSchema> | (() => Record<string, RuntimeSchema>);
    readonly options?: readonly RuntimeSchema[];
  };
  readonly unwrap?: () => RuntimeSchema;
  readonly safeParse?: (value: unknown) => { success: boolean; data?: unknown };
};

const objectIdFromString = z
  .string()
  .refine((value) => {
    try {
      ObjectId.createFromHexString(value);
      return true;
    } catch {
      return false;
    }
  }, 'Invalid ObjectId hex string')
  .transform((value) => ObjectId.createFromHexString(value));

const shapeOf = (schema: RuntimeSchema): Record<string, RuntimeSchema> | undefined => {
  const shape = schema._def?.shape;
  return typeof shape === 'function' ? shape() : shape;
};

/** Convert common HTTP string inputs, then let the original schema validate them strictly. */
export const coerceSchemaInput = (schema: RuntimeSchema, value: unknown): unknown => {
  if (schema.safeParse?.(value).success) return value;

  const type = schema._def?.type;
  if (
    schema.unwrap &&
    ['optional', 'nullable', 'default', 'nonoptional', 'readonly', 'catch'].includes(type ?? '')
  ) {
    return coerceSchemaInput(schema.unwrap(), value);
  }

  if (type === 'number' && typeof value === 'string' && value.trim() !== '') {
    const number = Number(value);
    return Number.isNaN(number) ? value : number;
  }

  if (type === 'boolean' && typeof value === 'string') {
    const result = z.stringbool().safeParse(value);
    return result.success ? result.data : value;
  }

  if (type === 'date' && typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date;
  }

  if (type === 'object' && value !== null && typeof value === 'object' && !Array.isArray(value)) {
    const shape = shapeOf(schema);
    if (!shape) return value;
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        shape[key] ? coerceSchemaInput(shape[key]!, entry) : entry,
      ]),
    );
  }

  if (type === 'array' && Array.isArray(value) && schema._def?.element) {
    return value.map((entry) => coerceSchemaInput(schema._def!.element!, entry));
  }

  if (type === 'union') {
    for (const option of schema._def?.options ?? []) {
      const coerced = coerceSchemaInput(option, value);
      if (option.safeParse?.(coerced).success) return coerced;
    }
  }

  if (typeof value === 'string' && schema.safeParse?.(new ObjectId()).success) {
    const parsed = objectIdFromString.safeParse(value);
    if (parsed.success && schema.safeParse(parsed.data).success) return parsed.data;
  }

  return value;
};

/** Wrap each field in preprocessing while preserving the outer ZodObject API. */
export const coerceSchemaShape = <Shape extends SchemaShape>(
  shape: Shape,
): CoercedSchemaShape<Shape> =>
  Object.fromEntries(
    Object.entries(shape).map(([key, field]) => [
      key,
      z.preprocess((input) => coerceSchemaInput(field as RuntimeSchema, input), field),
    ]),
  ) as unknown as CoercedSchemaShape<Shape>;
