import type { Infer, Schema, SchemaRelationMap } from '../../schema/index.js';
import type { HiddenDocumentKey, VisibleDocument } from '../types/document.js';
import type { Simplify } from '../types/utils.js';
import type { PopulateSpecs } from './spec.js';

type RelationTarget<Relation> = Relation extends { resolve: () => infer Target } ? Target : never;
type RelationDocument<Relation> = Infer<RelationTarget<Relation>>;
type RelationMapOf<Relation> = Relation extends { readonly __targetRelations?: infer Relations }
  ? NonNullable<Relations> extends SchemaRelationMap
    ? NonNullable<Relations>
    : {}
  : RelationTarget<Relation> extends { readonly relationMap: infer Relations }
    ? Relations extends SchemaRelationMap
      ? Relations
      : {}
    : {};

type ShownFields<Spec> = Spec extends { show?: readonly (infer Fields)[] } ? Fields : never;

type VisibleRelationDocument<Relation, Spec> =
  RelationDocument<Relation> extends infer Document extends object
    ? RelationTarget<Relation> extends Schema<infer Shape, any>
      ? Omit<VisibleDocument<Shape> & Document, HiddenDocumentKey<Shape>> &
          Pick<Document, Extract<ShownFields<Spec>, keyof Document>>
      : Document
    : never;

/** Replace relation identifiers with their inferred populated result types. */
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
  ? VisibleRelationDocument<Relation, Spec> extends infer Document extends object
    ? PopulatedResult<Document, RelationMapOf<Relation>, Nested>
    : never
  : VisibleRelationDocument<Relation, Spec>;
