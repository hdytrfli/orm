import type { VirtualBinding } from '../../relations/definitions.js';
import type { SchemaRelationMap, SchemaShape, SchemaVirtualMap } from '../../schema/index.js';
import type { HiddenDocumentKey, ModelDocument, VisibleDocument } from '../types/document.js';
import type { SelectableKey, SelectedDocument } from '../types/selection.js';
import type { Simplify } from '../types/utils.js';
import type { PopulateSpecs, RelationMapOf, RelationTargetOf } from './spec.js';

type RelationDocument<Relation> =
  RelationTargetOf<Relation> extends {
    readonly __shape: infer Shape extends SchemaShape;
  }
    ? ModelDocument<Shape>
    : never;

type FieldSelectors<Spec> = Spec extends { fields?: readonly (infer Fields)[] } ? Fields : never;
type SelectedFields<Spec> = Exclude<FieldSelectors<Spec>, '$all' | `+${string}`>;
type ExplicitHiddenFields<Spec> =
  FieldSelectors<Spec> extends infer Field
    ? Field extends `+${infer Hidden}`
      ? Hidden
      : never
    : never;
type IncludesAllFields<Spec> = '$all' extends FieldSelectors<Spec> ? true : false;
type NestedPopulateRefs<Spec> = Spec extends { populate?: readonly (infer Nested)[] }
  ? Nested extends { ref: infer Name extends string }
    ? Name
    : never
  : never;
type NestedRelationFields<Shape extends SchemaShape, Spec> =
  Extract<NestedPopulateRefs<Spec>, SelectableKey<Shape>> extends infer Keys extends
    SelectableKey<Shape>
    ? [Keys] extends [never]
      ? {}
      : SelectedDocument<Shape, Keys>
    : {};

type VisibleRelationDocument<Relation, Spec> =
  RelationDocument<Relation> extends infer Document extends object
    ? RelationTargetOf<Relation> extends { readonly __shape: infer Shape extends SchemaShape }
      ? SelectedPopulationDocument<Shape, Document, Spec>
      : Document
    : never;

/** Replace relation identifiers with their inferred populated result types. */
export type PopulatedResult<
  Result extends object,
  Relations extends SchemaRelationMap,
  Specs extends PopulateSpecs<Relations, Virtuals>,
  Virtuals extends SchemaVirtualMap = {},
> = Simplify<
  ApplyRelationSpecs<Result, Relations, Specs> & {
    [Name in Extract<VirtualSpec<Specs[number], Virtuals>['ref'], string>]: PopulatedVirtual<
      Virtuals[Name],
      Extract<VirtualSpec<Specs[number], Virtuals>, { ref: Name }>
    >;
  }
>;

type VirtualSpec<Spec, Virtuals extends SchemaVirtualMap> = Spec extends {
  ref: keyof Virtuals & string;
}
  ? Spec
  : never;

type ReplacePath<
  Value,
  Path extends string,
  Replacement,
> = Path extends `${infer Head}.${infer Tail}`
  ? Value extends object
    ? {
        [Key in keyof Value]: Key extends Head
          ?
              | ReplacePath<NonNullable<Value[Key]>, Tail, Replacement>
              | Extract<Value[Key], null | undefined>
          : Value[Key];
      }
    : Value
  : Value extends object
    ? {
        [Key in keyof Value]: Key extends Path
          ? Replacement | Extract<Value[Key], null | undefined>
          : Value[Key];
      }
    : Value;

type ApplyRelationSpecs<
  Result,
  Relations extends SchemaRelationMap,
  Specs extends readonly unknown[],
> = Specs extends readonly [infer Spec, ...infer Remaining]
  ? Spec extends { ref: infer Path extends keyof Relations & string }
    ? ApplyRelationSpecs<
        ReplacePath<Result, Path, PopulatedRelation<Relations[Path], Spec> | null>,
        Relations,
        Remaining
      >
    : ApplyRelationSpecs<Result, Relations, Remaining>
  : Result;

type PopulatedRelation<Relation, Spec> = Spec extends {
  populate: infer Nested extends PopulateSpecs<RelationMapOf<Relation>, VirtualMapOf<Relation>>;
}
  ? VisibleRelationDocument<Relation, Spec> extends infer Document extends object
    ? PopulatedResult<Document, RelationMapOf<Relation>, Nested, VirtualMapOf<Relation>>
    : never
  : VisibleRelationDocument<Relation, Spec>;

type VirtualMapOf<Virtual> = Virtual extends { resolve: () => infer Target }
  ? Target extends { readonly virtualMap: infer Virtuals extends SchemaVirtualMap }
    ? Virtuals
    : {}
  : {};

type PopulatedVirtual<Virtual, Spec> =
  Virtual extends VirtualBinding<any, any, any, infer Kind>
    ? Kind extends 'count' | 'distinct' | 'sum'
      ? number
      : Kind extends 'avg' | 'min' | 'max' | 'median'
        ? number | null
        : Kind extends 'first'
          ? VisibleVirtualDocument<Virtual, Spec> | null
          : VisibleVirtualDocument<Virtual, Spec>[]
    : never;

type VisibleVirtualDocument<Virtual, Spec> =
  RelationDocument<Virtual> extends infer Document extends object
    ? RelationTargetOf<Virtual> extends { readonly __shape: infer Shape extends SchemaShape }
      ? SelectedPopulationDocument<Shape, Document, Spec>
      : Document
    : never;

type SelectedPopulationDocument<
  Shape extends SchemaShape,
  Document extends object,
  Spec,
> = (Spec extends { fields: readonly unknown[] }
  ? IncludesAllFields<Spec> extends true
    ? Omit<VisibleDocument<Shape> & Document, HiddenDocumentKey<Shape>>
    : [SelectedFields<Spec>] extends [never]
      ? Pick<ModelDocument<Shape>, '_id'>
      : SelectedDocument<Shape, Extract<SelectedFields<Spec>, SelectableKey<Shape>>>
  : Omit<VisibleDocument<Shape> & Document, HiddenDocumentKey<Shape>>) &
  Pick<Document, Extract<ExplicitHiddenFields<Spec>, keyof Document>> &
  NestedRelationFields<Shape, Spec>;
