import type { Schema } from '../schema/schema.js';

/** Schema object accepted as a lazy relation target or registry entry. */
export type SchemaLike = Schema<any, any, any, any, any, any>;

/** Metadata for a forward ObjectId relation. */
export interface SchemaRelation<
  Target extends SchemaLike = SchemaLike,
  LocalField extends string = string,
  ForeignField extends string = string,
  TargetRelations = Target extends { readonly relationMap: infer Relations } ? Relations : {},
> {
  readonly resolve: () => Target;
  readonly localField: LocalField;
  readonly foreignField: ForeignField;
  /** Type-only target schema for stable population inference. */
  readonly __target?: Target;
  /** Target relations are carried separately to avoid recursively wrapping its schema type. */
  readonly __targetRelations?: TargetRelations;
}

export type SchemaRelationMap = Record<string, SchemaRelation>;

export type VirtualKind =
  | 'many'
  | 'first'
  | 'count'
  | 'distinct'
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'median';

/** Marker accepted in schema shapes for non-persisted virtual fields. */
export type VirtualField<Kind extends VirtualKind = VirtualKind> = {
  readonly __mongormVirtual: Kind;
};

/** A schema-declared virtual before its registry binding is applied. */
export type VirtualPlaceholder<Kind extends VirtualKind = VirtualKind> = {
  readonly kind: Kind;
};

/** Resolved binding for a schema-declared virtual. */
export type VirtualBinding<
  Target extends SchemaLike = SchemaLike,
  Ref extends string = string,
  Via extends string = string,
  Kind extends VirtualKind = VirtualKind,
> = {
  readonly kind: Kind;
  readonly ref: Ref;
  readonly via: Via;
  readonly field?: string;
  /** Type-only source schema; runtime resolution is performed by the database registry. */
  readonly __target?: Target;
};

export type SchemaVirtualMap = Record<string, VirtualBinding>;
export type SchemaVirtualDeclarations = Record<string, VirtualPlaceholder>;
