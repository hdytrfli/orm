import type { Schema } from '../schema/schema.js';

/** Schema object accepted as a lazy relation target or registry entry. */
export type SchemaLike = Schema<any, any, any, any, any>;

/** Metadata for a one-way relation between two registered schemas. */
export interface SchemaRelation<
  Target extends SchemaLike = SchemaLike,
  LocalField extends string = string,
  ForeignField extends string = string,
  TargetRelations = Target extends { readonly relationMap: infer Relations } ? Relations : {},
> {
  readonly resolve: () => Target;
  readonly localField: LocalField;
  readonly foreignField: ForeignField;
  /** Target relations are carried separately to avoid recursively wrapping its schema type. */
  readonly __targetRelations?: TargetRelations;
}

export type SchemaRelationMap = Record<string, SchemaRelation>;

/** Relation target declaration accepted by `Schema.relations()`. */
export type RelationInput<Target extends SchemaLike = SchemaLike> =
  | (() => Target)
  | {
      target: () => Target;
      foreignField?: string;
    };

export type RelationInputTarget<Input> = Input extends () => infer Target
  ? Target
  : Input extends { target: () => infer Target }
    ? Target
    : never;
