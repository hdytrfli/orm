import type { Infer, Schema, SchemaRelationMap } from '../../schema/index.js';
import type { HiddenDocumentKey, VisibleDocument } from '../types/document.js';
import type { SelectableKey } from '../types/selection.js';
import type { Simplify } from '../types/utils.js';

type RelationTarget<Relation> = Relation extends { resolve: () => infer Target } ? Target : never;
type RelationDocument<Relation> = Infer<RelationTarget<Relation>>;
type ShownKeys<Spec> = Spec extends { show?: readonly (infer Keys)[] } ? Keys : never;
type RelationResultDocument<Relation, Spec> =
  RelationDocument<Relation> extends infer Document extends object
    ? RelationTarget<Relation> extends Schema<infer TargetShape, any>
      ? Omit<VisibleDocument<TargetShape> & Document, HiddenDocumentKey<TargetShape>> &
          Pick<Document, Extract<ShownKeys<Spec>, keyof Document>>
      : Document
    : never;

type RelationMapOf<Relation> = Relation extends { readonly __targetRelations?: infer Relations }
  ? NonNullable<Relations> extends SchemaRelationMap
    ? NonNullable<Relations>
    : {}
  : RelationTarget<Relation> extends { readonly relationMap: infer TargetRelations }
    ? TargetRelations extends SchemaRelationMap
      ? TargetRelations
      : {}
    : {};

type RelationSelect<Relation> =
  RelationTarget<Relation> extends Schema<infer TargetShape, any>
    ? Exclude<SelectableKey<TargetShape>, '_id'>
    : never;
type RelationHiddenSelect<Relation> =
  RelationTarget<Relation> extends Schema<infer TargetShape, any>
    ? HiddenDocumentKey<TargetShape>
    : never;

export type ScopeName<Scopes> = Extract<keyof Scopes, string>;
export type PopulationMode = 'none' | 'populate' | 'scope';

/** A typed description of one declared relation to load. */
export type PopulateSpec<Relations extends SchemaRelationMap> = {
  [Name in Extract<keyof Relations, string>]: {
    ref: Name;
    select?: readonly RelationSelect<Relations[Name]>[];
    show?: readonly RelationHiddenSelect<Relations[Name]>[];
    populate?: PopulateSpecs<RelationMapOf<Relations[Name]>>;
  };
}[Extract<keyof Relations, string>];

/** A list of relation-population specifications. */
export type PopulateSpecs<Relations extends SchemaRelationMap> = readonly PopulateSpec<Relations>[];

/** Query result after replacing relation IDs with populated documents. */
export type PopulatedResult<
  Result extends object,
  Relations extends SchemaRelationMap,
  Specs extends PopulateSpecs<Relations>,
> = Simplify<
  Omit<Result, Extract<Specs[number]['ref'], keyof Result>> & {
    [Spec in Specs[number] as Spec['ref']]: PopulatedRelation<Relations[Spec['ref']], Spec> | null;
  }
>;

type PopulatedRelation<Relation, Spec> = Spec extends {
  populate: infer Nested extends PopulateSpecs<RelationMapOf<Relation>>;
}
  ? RelationResultDocument<Relation, Spec> extends infer PopulatedDocument extends object
    ? PopulatedResult<PopulatedDocument, RelationMapOf<Relation>, Nested>
    : never
  : RelationResultDocument<Relation, Spec>;
