import type { Schema } from '../schema/schema.js';

/** Schema object accepted as a lazy relation target or registry entry. */
export type SchemaLike = Schema<any, any, any, any, any, any>;

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

export type VirtualAggregate<Numeric extends string = string> = {
  readonly field: Numeric;
  readonly type: 'count' | 'sum' | 'average' | 'min' | 'max';
};

export type VirtualDefinitionOptions<
  Select extends string = string,
  Show extends string = string,
  Numeric extends string = string,
  Match = Record<string, unknown>,
> =
  | {
      readonly type: 'many';
      readonly aggregate: VirtualAggregate<Numeric>;
      readonly match?: Match;
    }
  | {
      readonly type: 'many';
      readonly select?: readonly Select[];
      readonly show?: readonly Show[];
      readonly match?: Match;
    }
  | {
      readonly type: 'first';
      readonly select?: readonly Select[];
      readonly show?: readonly Show[];
    };

/** Metadata for a reverse/virtual relation populated from a target collection. */
export type SchemaVirtual<
  Target extends SchemaLike = SchemaLike,
  LocalField extends string = string,
  ForeignField extends string = string,
  Options extends VirtualDefinitionOptions = VirtualDefinitionOptions,
> = Options & {
  readonly resolve: () => Target;
  readonly local: LocalField;
  readonly foreign: ForeignField;
  /** Target relations are carried separately to avoid recursively wrapping its schema type. */
  readonly __targetRelations?: Target extends { readonly relationMap: infer Relations }
    ? Relations
    : {};
};

export type SchemaVirtualMap = Record<string, SchemaVirtual>;
