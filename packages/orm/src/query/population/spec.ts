import type { SchemaShape } from '../../schema/contracts.js';
import type { SchemaRelationMap, SchemaVirtualMap, VirtualBinding } from '../../schema/index.js';
import type { FieldSelection } from '../types/selection.js';

export type RelationTargetOf<Relation> = Relation extends { readonly __target?: infer Target }
  ? NonNullable<Target>
  : Relation extends { resolve: () => infer Target }
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
  RelationTargetOf<Relation> extends { readonly __shape: infer Shape extends SchemaShape }
    ? FieldSelection<Shape>
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
  [Name in Extract<keyof Virtuals, string>]: Virtuals[Name] extends VirtualBinding<
    infer Target,
    string,
    string,
    infer Kind
  >
    ? Kind extends 'many' | 'first'
      ? { ref: Name; fields?: readonly PopulationField<Target>[] }
      : { ref: Name }
    : never;
}[Extract<keyof Virtuals, string>];

export type PopulateSpecs<
  Relations extends SchemaRelationMap,
  Virtuals extends SchemaVirtualMap = {},
> = readonly (PopulateSpec<Relations> | VirtualSpec<Virtuals>)[];
export type PopulateSpecsOnly<Relations extends SchemaRelationMap> =
  readonly PopulateSpec<Relations>[];
export type VirtualSpecs<Virtuals extends SchemaVirtualMap> = readonly VirtualSpec<Virtuals>[];
type WithoutExtraKeys<Spec, Allowed extends string> =
  Exclude<keyof Spec, Allowed> extends never ? Spec : never;

export type ValidatePopulateSpecs<
  Specs extends readonly unknown[],
  Relations extends SchemaRelationMap,
> = {
  [Index in keyof Specs]: Specs[Index] extends { ref: infer Name extends string }
    ? Name extends keyof Relations
      ? WithoutExtraKeys<Specs[Index], 'ref' | 'fields' | 'populate'>
      : never
    : never;
};

export type ValidateVirtualSpecs<Specs extends readonly unknown[]> = {
  [Index in keyof Specs]: Specs[Index] extends { ref: string }
    ? WithoutExtraKeys<Specs[Index], 'ref' | 'fields'>
    : never;
};
