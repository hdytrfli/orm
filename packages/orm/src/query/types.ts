import { ObjectId, type Condition, type Document, type RootFilterOperators } from 'mongodb';

import type { SchemaShape } from '../schema/contracts.js';
import type { Infer, Schema, SchemaRelationMap } from '../schema/index.js';
import type { ModelCursor } from './cursor.js';

export type StoredDocument<Shape extends SchemaShape> = Infer<Schema<Shape>> & Document;

type ModelFilterForDocument<
  DocumentShape extends Document,
  FieldShape extends object = DocumentShape,
> = Partial<{
  [Key in keyof FieldShape]: Condition<FieldShape[Key]>;
}> &
  Partial<
    Pick<
      RootFilterOperators<DocumentShape>,
      '$comment' | '$expr' | '$jsonSchema' | '$text' | '$where'
    >
  > & {
    $and?: ModelFilterForDocument<DocumentShape, FieldShape>[];
    $nor?: ModelFilterForDocument<DocumentShape, FieldShape>[];
    $or?: ModelFilterForDocument<DocumentShape, FieldShape>[];
  };

export type ModelFilter<Shape extends SchemaShape> = ModelFilterForDocument<
  StoredDocument<Shape>,
  Infer<Schema<Shape>>
>;

type SortDirection = 'asc' | 'desc';
export type ModelSort<Shape extends SchemaShape> = Partial<
  Record<Extract<keyof Infer<Schema<Shape>>, string>, SortDirection>
>;

export type ModelDocument<Shape extends SchemaShape> = Infer<Schema<Shape>>;
export type HiddenKey<Shape extends SchemaShape> = {
  [Key in keyof Shape]: Shape[Key] extends { readonly __hidden: true } ? Key : never;
}[keyof Shape];
export type HiddenDocumentKey<Shape extends SchemaShape> = Extract<
  HiddenKey<Shape>,
  keyof ModelDocument<Shape>
> &
  string;
type NestedDocumentKeys<Value, Prefix extends string = ''> = Value extends object
  ? Value extends ObjectId | Date
    ? never
    : {
        [Key in Extract<keyof Value, string>]: NonNullable<Value[Key]> extends object
          ? `${Prefix}${Key}` | `${Prefix}${Key}.${NestedDocumentKeys<NonNullable<Value[Key]>>}`
          : `${Prefix}${Key}`;
      }[Extract<keyof Value, string>]
  : never;
type NestedSelectableKey<Shape extends SchemaShape> = {
  [Key in Extract<keyof Shape, string>]: Key extends keyof ModelDocument<Shape>
    ? NonNullable<ModelDocument<Shape>[Key]> extends object
      ? `${Key}.${NestedDocumentKeys<NonNullable<ModelDocument<Shape>[Key]>>}`
      : never
    : never;
}[Extract<keyof Shape, string>];
export type CursorMethod<
  Shape extends SchemaShape,
  Result extends object,
  Ready extends boolean,
> = Ready extends true ? (after?: ObjectId) => ModelCursor<Shape, Result> : undefined;
export type SelectableKey<Shape extends SchemaShape> =
  | Exclude<Extract<keyof ModelDocument<Shape>, string>, '_id' | HiddenDocumentKey<Shape>>
  | NestedSelectableKey<Shape>;
type PathSelection<Value, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof Value
    ? { [Key in Head]: PathSelection<NonNullable<Value[Key]>, Tail> }
    : never
  : Path extends keyof Value
    ? Pick<Value, Path>
    : never;
type UnionToIntersection<Value> = (Value extends unknown ? (input: Value) => void : never) extends (
  input: infer Intersection,
) => void
  ? Intersection
  : never;
type Simplify<Value> = { [Key in keyof Value]: Value[Key] };
export type VisibleDocument<Shape extends SchemaShape> = Omit<
  ModelDocument<Shape>,
  Extract<HiddenKey<Shape>, keyof ModelDocument<Shape>>
>;
export type SelectedDocument<Shape extends SchemaShape, Key extends SelectableKey<Shape>> = [
  Key,
] extends [never]
  ? VisibleDocument<Shape>
  : Simplify<
      Pick<ModelDocument<Shape>, '_id'> &
        UnionToIntersection<PathSelection<ModelDocument<Shape>, Extract<Key, string>>>
    >;
type RelationTarget<Relation> = Relation extends { resolve: () => infer Target } ? Target : never;
type RelationDocument<Relation> =
  RelationTarget<Relation> extends Schema<infer TargetShape, any>
    ? Infer<Schema<TargetShape>>
    : never;
type RelationMapOf<Relation> =
  RelationTarget<Relation> extends { readonly relationMap: infer TargetRelations }
    ? TargetRelations extends SchemaRelationMap
      ? TargetRelations
      : {}
    : {};
export type ScopeName<Scopes> = Extract<keyof Scopes, string>;
export type PopulationMode = 'none' | 'populate' | 'scope';
type RelationSelect<Relation> =
  RelationTarget<Relation> extends Schema<infer TargetShape, any>
    ? Exclude<SelectableKey<TargetShape>, '_id'>
    : never;

export type PopulateSpec<Relations extends SchemaRelationMap> = {
  [Name in Extract<keyof Relations, string>]: {
    ref: Name;
    select?: readonly RelationSelect<Relations[Name]>[];
    populate?: PopulateSpecs<RelationMapOf<Relations[Name]>>;
  };
}[Extract<keyof Relations, string>];
export type PopulateSpecs<Relations extends SchemaRelationMap> = readonly PopulateSpec<Relations>[];
export type PopulatedResult<
  Result extends object,
  Relations extends SchemaRelationMap,
  Specs extends PopulateSpecs<Relations>,
> = Omit<Result, Extract<Specs[number]['ref'], keyof Result>> & {
  [Spec in Specs[number] as Spec['ref']]: PopulatedRelation<Relations[Spec['ref']], Spec> | null;
};

type PopulatedRelation<Relation, Spec> = Spec extends {
  populate: infer Nested extends PopulateSpecs<RelationMapOf<Relation>>;
}
  ? RelationDocument<Relation> extends infer Document extends object
    ? PopulatedResult<Document, RelationMapOf<Relation>, Nested>
    : never
  : RelationDocument<Relation>;
