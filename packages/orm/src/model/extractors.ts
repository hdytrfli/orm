import type { ObjectId } from 'mongodb';
import type { ZodType } from 'zod';

import type { ModelFilter, ModelSort, PopulateSpecs } from '../query/index.js';
import type { ModelDocument } from '../query/types/document.js';
import type { CoercedSchemaShape } from '../schema/coercion.js';
import type {
  SchemaIndex,
  SchemaRelationMap,
  SchemaShape,
  SchemaOptions,
  SchemaVirtualMap,
  ScopeDefinitions,
  SoftDeleteEnabled,
} from '../schema/index.js';
import type { Model } from './model.js';
import type { CreateInput, UpdateInput } from './types.js';

/** Any Mongorm model instance, for use as a generic constraint. */
export type AnyModel = Model<any, any, any, any, any, any>;

/** Extract the schema field shape registered on a model. */
export type ShapeOf<T> = T extends { readonly __shape: infer Shape extends SchemaShape }
  ? Shape
  : never;

/** Extract the relation map registered on a model. */
export type RelationsOf<T> = T extends {
  readonly __relations: infer Relations extends SchemaRelationMap;
}
  ? Relations
  : never;

/** Extract the named population scopes registered on a model. */
export type ScopesOf<T> = T extends { readonly __scopes: infer Scopes extends ScopeDefinitions }
  ? Scopes
  : never;

/** Extract the schema options registered on a model. */
export type OptionsOf<T> = T extends { readonly __options: infer Options extends SchemaOptions }
  ? Options
  : never;

/** Extract the index definitions registered on a model. */
export type IndexesOf<T> = T extends {
  readonly __indexes: infer Indexes extends readonly SchemaIndex<any>[];
}
  ? Indexes
  : never;

/** Extract the virtual relation map registered on a model. */
export type VirtualsOf<T> = T extends {
  readonly __virtuals: infer Virtuals extends SchemaVirtualMap;
}
  ? Virtuals
  : never;

/** Derive a model's schema-aware MongoDB filter type. */
export type FilterOf<T> = ModelFilter<ShapeOf<T>>;

/** Derive the schema-aware sort specification accepted by a model. */
export type SortOf<T> = ModelSort<ShapeOf<T>>;

type NestedFieldPaths<Value> = Value extends ObjectId | Date | readonly unknown[]
  ? never
  : Value extends object
    ? {
        [Key in Extract<keyof Value, string>]:
          | Key
          | `${Key}.${NestedFieldPaths<NonNullable<Value[Key]>>}`;
      }[Extract<keyof Value, string>]
    : never;

/** All persisted field paths on a model, including parents and nested paths. */
export type FieldPathsOf<T> = Extract<NestedFieldPaths<ModelDocument<ShapeOf<T>>>, string>;

/** Field paths on related documents, prefixed with their relation name. */
export type RelationPathsOf<T> = {
  [Relation in Extract<keyof RelationsOf<T>, string>]: RelationsOf<T>[Relation] extends {
    resolve: () => infer Target;
  }
    ? `${Relation}.${Extract<FieldPathsOf<Target>, string>}`
    : never;
}[Extract<keyof RelationsOf<T>, string>];

/** Derive the create input accepted by a model. */
export type CreateInputOf<T> = CreateInput<ShapeOf<T>, OptionsOf<T>>;

/** Derive the partial update input accepted by a model. */
export type UpdateInputOf<T> = UpdateInput<ShapeOf<T>, OptionsOf<T>>;

/** A Zod create schema whose partial form validates the model's update input. */
export type ZodSchemaOf<T extends AnyModel> = ZodType<CreateInputOf<T>> & {
  partial: () => ZodType<UpdateInputOf<T>>;
};

/** A coerced Zod parser whose output matches the model's parsed schema shape. */
export type CoercedOf<T extends AnyModel> = import('zod').ZodObject<CoercedSchemaShape<ShapeOf<T>>>;

/** Derive valid population specifications from a model's relations and virtuals. */
export type PopulateOf<T> = PopulateSpecs<RelationsOf<T>, VirtualsOf<T>>;

/** The names of registry-defined scopes available on a model. */
export type ModelScopeName<T> = Extract<keyof ScopesOf<T>, string>;

/** Whether a model's schema enables soft deletion. */
export type ModelSoftDeleteEnabled<T> = SoftDeleteEnabled<OptionsOf<T>>;

/** Infer the model instance type associated with a schema type. */
export type ModelFromSchema<SchemaType> = SchemaType extends object
  ? Model<
      SchemaType extends { readonly __shape: infer Shape extends SchemaShape } ? Shape : never,
      SchemaType extends {
        readonly __relations: infer Relations extends SchemaRelationMap;
      }
        ? Relations
        : never,
      SchemaType extends { readonly __scopes: infer Scopes extends ScopeDefinitions }
        ? Scopes
        : never,
      SchemaType extends { readonly __options: infer Options extends SchemaOptions }
        ? Options
        : never,
      SchemaType extends {
        readonly __indexes: infer Indexes extends readonly SchemaIndex<any>[];
      }
        ? Indexes
        : never,
      SchemaType extends { readonly __virtuals: infer Virtuals extends SchemaVirtualMap }
        ? Virtuals
        : never
    >
  : never;
