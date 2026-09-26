import type { Schema, SchemaRelationMap, SchemaVirtualMap } from '../../schema/index.js';
import type { HiddenDocumentKey } from '../types/document.js';
import type { SelectableKey } from '../types/selection.js';

type RelationTarget<Relation> = Relation extends { resolve: () => infer Target } ? Target : never;
type TargetVirtuals<Relation> =
  RelationTarget<Relation> extends {
    readonly virtualMap: infer Virtuals;
  }
    ? Virtuals extends SchemaVirtualMap
      ? Virtuals
      : {}
    : {};

type NestedRelations<Relation> = Relation extends { readonly __targetRelations?: infer Relations }
  ? NonNullable<Relations> extends SchemaRelationMap
    ? NonNullable<Relations>
    : {}
  : RelationTarget<Relation> extends { readonly relationMap: infer Relations }
    ? Relations extends SchemaRelationMap
      ? Relations
      : {}
    : {};

type SelectableRelationField<Relation> =
  RelationTarget<Relation> extends Schema<infer Shape, any>
    ? Exclude<SelectableKey<Shape>, '_id'>
    : never;

type HiddenRelationField<Relation> =
  RelationTarget<Relation> extends Schema<infer Shape, any> ? HiddenDocumentKey<Shape> : never;

/** A named population scope available on a query. */
export type ScopeName<Scopes> = Extract<keyof Scopes, string>;

/** Tracks which query population API has been used. */
export type PopulationMode = 'none' | 'populate' | 'scope';

/** A typed instruction for populating one declared relation. */
export type PopulateSpec<Relations extends SchemaRelationMap> = {
  [Name in Extract<keyof Relations, string>]: {
    ref: Name;
    select?: readonly SelectableRelationField<Relations[Name]>[];
    show?: readonly HiddenRelationField<Relations[Name]>[];
    populate?: PopulateSpecs<NestedRelations<Relations[Name]>, TargetVirtuals<Relations[Name]>>;
  };
}[Extract<keyof Relations, string>];

/** A typed instruction for populating a declared virtual relation. */
type VirtualPopulateSpec<Virtuals extends SchemaVirtualMap> = {
  [Name in Extract<keyof Virtuals, string>]: {
    virtual: Name;
  };
}[Extract<keyof Virtuals, string>];

/** A typed list of population instructions. */
export type PopulateSpecs<
  Relations extends SchemaRelationMap,
  Virtuals extends SchemaVirtualMap = {},
> = readonly (PopulateSpec<Relations> | VirtualPopulateSpec<Virtuals>)[];

/** Reject virtual-query options now that they belong on the virtual definition. */
export type ValidatePopulateSpecs<Specs extends readonly unknown[]> = {
  [Index in keyof Specs]: Specs[Index] extends { virtual: string }
    ? Exclude<keyof Specs[Index], 'virtual'> extends never
      ? Specs[Index]
      : never
    : Specs[Index];
};
