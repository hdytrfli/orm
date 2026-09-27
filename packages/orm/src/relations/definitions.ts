import type { Schema } from '../schema/schema.js';

/** Schema object accepted as a lazy relation target or registry entry. */
export type SchemaLike = Schema<any, any, any, any, any, any>;

/** Metadata for an ObjectId edge and its optional reverse traversal name. */
export interface SchemaRelation<
  Target extends SchemaLike = SchemaLike,
  LocalField extends string = string,
  ForeignField extends string = string,
  TargetRelations = Target extends { readonly relationMap: infer Relations } ? Relations : {},
> {
  readonly resolve: () => Target;
  readonly localField: LocalField;
  readonly foreignField: ForeignField;
  readonly inverse?: string;
  /** Target relations are carried separately to avoid recursively wrapping its schema type. */
  readonly __targetRelations?: TargetRelations;
}

export type SchemaRelationMap = Record<string, SchemaRelation>;

export type VirtualAggregate<Numeric extends string = string> = {
  readonly field: Numeric;
  readonly type: 'count' | 'sum' | 'average' | 'min' | 'max';
};

/** Metadata for a reverse/virtual relation populated from a target collection. */
export type SchemaVirtual<
  Target extends SchemaLike = SchemaLike,
  LocalField extends string = string,
  ForeignField extends string = string,
> = {
  readonly resolve: () => Target;
  readonly local: LocalField;
  readonly foreign: ForeignField;
  /** Target relations are carried separately to avoid recursively wrapping its schema type. */
  readonly __targetRelations?: Target extends { readonly relationMap: infer Relations }
    ? Relations
    : {};
};

export type SchemaVirtualMap = Record<string, SchemaVirtual>;
