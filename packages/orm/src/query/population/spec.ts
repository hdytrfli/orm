import type { ObjectId } from 'mongodb';

import type {
  Schema,
  SchemaRelationMap,
  SchemaVirtualMap,
  VirtualAggregate,
} from '../../schema/index.js';
import type { InferShape } from '../../schema/inference.js';
import type { FieldSelection } from '../types/selection.js';

export type RelationTargetOf<Relation> = Relation extends { resolve: () => infer Target }
  ? Target
  : never;
export type RelationMapOf<Relation> = Relation extends {
  readonly __targetRelations?: infer Relations;
}
  ? NonNullable<Relations> extends SchemaRelationMap
    ? NonNullable<Relations>
    : {}
  : RelationTargetOf<Relation> extends { readonly relationMap: infer Relations }
    ? Relations extends SchemaRelationMap
      ? Relations
      : {}
    : {};
type PopulationField<Relation> =
  RelationTargetOf<Relation> extends Schema<infer Shape, any> ? FieldSelection<Shape> : never;
type NumericTarget<Relation> = Extract<NumericKeys<InferShape<RelationTargetOf<Relation>>>, string>;
type NumericKeys<Value, Prefix extends string = ''> = Value extends object
  ? {
      [Key in Extract<keyof Value, string>]-?: NonNullable<Value[Key]> extends number
        ? `${Prefix}${Key}`
        : NonNullable<Value[Key]> extends ObjectId | Date | readonly unknown[]
          ? never
          : NonNullable<Value[Key]> extends object
            ? NumericKeys<NonNullable<Value[Key]>, `${Prefix}${Key}.`>
            : never;
    }[Extract<keyof Value, string>]
  : never;

export type ScopeName<Scopes> = Extract<keyof Scopes, string>;
export type PopulationMode = 'none' | 'populate' | 'virtual' | 'scope';

export type PopulateSpec<Relations extends SchemaRelationMap> = {
  [Name in Extract<keyof Relations, string>]: {
    ref: Name;
    fields?: readonly PopulationField<Relations[Name]>[];
    populate?: PopulateSpecs<RelationMapOf<Relations[Name]>, {}>;
  };
}[Extract<keyof Relations, string>];

export type VirtualSpec<Virtuals extends SchemaVirtualMap> = {
  [Name in Extract<keyof Virtuals, string>]:
    | ({
        virtual: Name;
        type: 'many';
      } & (
        | {
            aggregate: VirtualAggregate<NumericTarget<Virtuals[Name]>>;
            fields?: never;
          }
        | {
            aggregate?: never;
            fields?: readonly PopulationField<Virtuals[Name]>[];
          }
      ))
    | {
        virtual: Name;
        type: 'first';
        fields?: readonly PopulationField<Virtuals[Name]>[];
      };
}[Extract<keyof Virtuals, string>];

export type PopulateSpecs<
  Relations extends SchemaRelationMap,
  Virtuals extends SchemaVirtualMap = {},
> = readonly (PopulateSpec<Relations> | VirtualSpec<Virtuals>)[];
export type PopulateSpecsOnly<Relations extends SchemaRelationMap> =
  readonly PopulateSpec<Relations>[];
export type VirtualSpecs<Virtuals extends SchemaVirtualMap> = readonly VirtualSpec<Virtuals>[];
export type ValidatePopulateSpecs<Specs extends readonly unknown[]> = {
  [Index in keyof Specs]: Specs[Index] extends { ref: string }
    ? Exclude<keyof Specs[Index], 'ref' | 'fields' | 'populate'> extends never
      ? Specs[Index]
      : never
    : never;
};
export type ValidateVirtualSpecs<Specs extends readonly unknown[]> = {
  [Index in keyof Specs]: Specs[Index] extends { virtual: string; type: 'many'; aggregate: object }
    ? Exclude<keyof Specs[Index], 'virtual' | 'type' | 'aggregate'> extends never
      ? Specs[Index]
      : never
    : Specs[Index] extends { virtual: string; type: 'many'; aggregate?: never }
      ? Exclude<keyof Specs[Index], 'virtual' | 'type' | 'fields' | 'aggregate'> extends never
        ? Specs[Index]
        : never
      : Specs[Index] extends { virtual: string; type: 'first' }
        ? Exclude<keyof Specs[Index], 'virtual' | 'type' | 'fields'> extends never
          ? Specs[Index]
          : never
        : never;
};
