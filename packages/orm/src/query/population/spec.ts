import type { ObjectId } from 'mongodb';

import type {
  Schema,
  SchemaRelationMap,
  SchemaVirtualMap,
  VirtualAggregate,
} from '../../schema/index.js';
import type { InferShape } from '../../schema/inference.js';
import type { HiddenDocumentKey } from '../types/document.js';
import type { SelectableKey } from '../types/selection.js';

type RelationTarget<Relation> = Relation extends { resolve: () => infer Target } ? Target : never;
type NestedRelations<Relation> = Relation extends { readonly __targetRelations?: infer Relations }
  ? NonNullable<Relations> extends SchemaRelationMap
    ? NonNullable<Relations>
    : {}
  : RelationTarget<Relation> extends { readonly relationMap: infer Relations }
    ? Relations extends SchemaRelationMap
      ? Relations
      : {}
    : {};
type SelectableTarget<Relation> =
  RelationTarget<Relation> extends Schema<infer Shape, any>
    ? Exclude<SelectableKey<Shape>, '_id'>
    : never;
type HiddenTarget<Relation> =
  RelationTarget<Relation> extends Schema<infer Shape, any> ? HiddenDocumentKey<Shape> : never;
type NumericTarget<Relation> =
  RelationTarget<Relation> extends infer Target
    ? Extract<NumericKeys<InferShape<Target>>, string>
    : never;
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
    select?: readonly SelectableTarget<Relations[Name]>[];
    show?: readonly HiddenTarget<Relations[Name]>[];
    populate?: PopulateSpecs<NestedRelations<Relations[Name]>, {}>;
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
            select?: never;
            show?: never;
          }
        | {
            aggregate?: never;
            select?: readonly SelectableTarget<Virtuals[Name]>[];
            show?: readonly HiddenTarget<Virtuals[Name]>[];
          }
      ))
    | {
        virtual: Name;
        type: 'first';
        select?: readonly SelectableTarget<Virtuals[Name]>[];
        show?: readonly HiddenTarget<Virtuals[Name]>[];
      };
}[Extract<keyof Virtuals, string>];

export type PopulateSpecs<
  Relations extends SchemaRelationMap,
  Virtuals extends SchemaVirtualMap = {},
> = readonly (PopulateSpec<Relations> | VirtualSpec<Virtuals>)[];
export type PopulateSpecsOnly<Relations extends SchemaRelationMap> =
  readonly PopulateSpec<Relations>[];
export type VirtualSpecs<Virtuals extends SchemaVirtualMap> = readonly VirtualSpec<Virtuals>[];
export type ValidatePopulateSpecs<Specs extends readonly unknown[]> = Specs;
export type ValidateVirtualSpecs<Specs extends readonly unknown[]> = {
  [Index in keyof Specs]: Specs[Index] extends { virtual: string; type: 'many'; aggregate: object }
    ? Exclude<keyof Specs[Index], 'virtual' | 'type' | 'aggregate'> extends never
      ? Specs[Index]
      : never
    : Specs[Index] extends { virtual: string; type: 'many'; aggregate?: never }
      ? Exclude<
          keyof Specs[Index],
          'virtual' | 'type' | 'select' | 'show' | 'aggregate'
        > extends never
        ? Specs[Index]
        : never
      : Specs[Index] extends { virtual: string; type: 'first' }
        ? Exclude<keyof Specs[Index], 'virtual' | 'type' | 'select' | 'show'> extends never
          ? Specs[Index]
          : never
        : never;
};
