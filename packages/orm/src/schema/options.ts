import { z } from 'zod';

import { withHidden, type HiddenSchema } from './hidden.js';

/** Built-in persistence behavior applied by a schema. */
export interface SchemaOptions {
  readonly timestamps?: boolean;
  readonly softdelete?: boolean;
  /** Hide Mongorm-managed fields from default query results. */
  readonly hideManaged?: boolean;
}

type ManagedSchema<
  Field extends z.ZodType,
  Options extends SchemaOptions,
> = Options['hideManaged'] extends true ? HiddenSchema<Field> : Field;

export type TimestampShape<Options extends SchemaOptions> = {
  createdAt: ManagedSchema<z.ZodDefault<z.ZodDate>, Options>;
  updatedAt: ManagedSchema<z.ZodDefault<z.ZodDate>, Options>;
};

export type SoftDeleteShape<Options extends SchemaOptions> = {
  deletedAt: ManagedSchema<z.ZodDefault<z.ZodNullable<z.ZodDate>>, Options>;
};

export type ManagedShape<Options extends SchemaOptions> = (Options['timestamps'] extends true
  ? TimestampShape<Options>
  : {}) &
  (Options['softdelete'] extends true ? SoftDeleteShape<Options> : {});

export type ManagedField<Options extends SchemaOptions> =
  | (Options['timestamps'] extends true ? 'createdAt' | 'updatedAt' : never)
  | (Options['softdelete'] extends true ? 'deletedAt' : never);

export type SoftDeleteEnabled<Options extends SchemaOptions> = Options['softdelete'] extends true
  ? true
  : false;

export const hasSoftDelete = (options: SchemaOptions): boolean => options.softdelete === true;

export const managedField = <Field extends z.ZodType>(
  field: Field,
  options: SchemaOptions,
): Field => (options.hideManaged ? withHidden(field).hidden() : field) as Field;
