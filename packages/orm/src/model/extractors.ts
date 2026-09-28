import type { ZodType } from 'zod';

import type { ModelFilter, ModelSort, PopulateSpecs } from '../query/index.js';
import type { Schema, SchemaIndex, SchemaVirtualMap, SoftDeleteEnabled } from '../schema/index.js';
import type { Model } from './model.js';
import type { CreateInput, UpdateInput } from './types.js';

/** Any Mongorm model instance, for use as a generic constraint. */
export type AnyModel = Model<any, any, any, any, any, any>;

/** Extract the schema field shape registered on a model. */
export type ShapeOf<T> = T extends Model<infer Shape, any, any, any, any, any> ? Shape : never;

/** Extract the relation map registered on a model. */
export type RelationsOf<T> =
  T extends Model<any, infer Relations, any, any, any, any> ? Relations : never;

/** Extract the named population scopes registered on a model. */
export type ScopesOf<T> = T extends Model<any, any, infer Scopes, any, any, any> ? Scopes : never;

/** Extract the schema options registered on a model. */
export type OptionsOf<T> =
  T extends Model<any, any, any, infer Options, any, any> ? Options : never;

/** Extract the index definitions registered on a model. */
export type IndexesOf<T> =
  T extends Model<any, any, any, any, infer Indexes, any> ? Indexes : never;

/** Extract the virtual relation map registered on a model. */
export type VirtualsOf<T> =
  T extends Model<any, any, any, any, any, infer Virtuals> ? Virtuals : never;

/** Derive a model's schema-aware MongoDB filter type. */
export type FilterOf<T> = ModelFilter<ShapeOf<T>>;

/** Derive the schema-aware sort specification accepted by a model. */
export type SortOf<T> = ModelSort<ShapeOf<T>>;

/** Derive the create input accepted by a model. */
export type CreateInputOf<T> = CreateInput<ShapeOf<T>, OptionsOf<T>>;

/** Derive the partial update input accepted by a model. */
export type UpdateInputOf<T> = UpdateInput<ShapeOf<T>, OptionsOf<T>>;

/** A Zod create schema whose partial form validates the model's update input. */
export type ZodSchemaOf<T extends AnyModel> = ZodType<CreateInputOf<T>> & {
  partial: () => ZodType<UpdateInputOf<T>>;
};

/** Derive valid population specifications from a model's relations and virtuals. */
export type PopulateOf<T> = PopulateSpecs<RelationsOf<T>, VirtualsOf<T>>;

/** The names of registry-defined scopes available on a model. */
export type ModelScopeName<T> = Extract<keyof ScopesOf<T>, string>;

/** Whether a model's schema enables soft deletion. */
export type ModelSoftDeleteEnabled<T> = SoftDeleteEnabled<OptionsOf<T>>;

/** Infer the model instance type associated with a schema type. */
export type ModelFromSchema<SchemaType> =
  SchemaType extends Schema<
    infer Shape,
    infer Relations,
    infer Scopes,
    infer Options,
    infer Indexes extends readonly SchemaIndex<any>[],
    infer Virtuals extends SchemaVirtualMap
  >
    ? Model<Shape, Relations, Scopes, Options, Indexes, Virtuals>
    : never;
