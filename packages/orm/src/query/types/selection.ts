import type { ObjectId } from 'mongodb';

import type { SchemaShape } from '../../schema/contracts.js';
import type { HiddenDocumentKey, HiddenKey, ModelDocument, VisibleDocument } from './document.js';
import type { Simplify, UnionToIntersection } from './utils.js';

type NestedDocumentKeys<Value> = Value extends object
  ? Value extends ObjectId | Date
    ? never
    : {
        [Key in Extract<keyof Value, string>]: NonNullable<Value[Key]> extends object
          ? Key | `${Key}.${NestedDocumentKeys<NonNullable<Value[Key]>>}`
          : Key;
      }[Extract<keyof Value, string>]
  : never;

type NestedSelectableKey<Shape extends SchemaShape> = {
  [Key in Extract<keyof Shape, string>]: Key extends keyof ModelDocument<Shape>
    ? NonNullable<ModelDocument<Shape>[Key]> extends object
      ? `${Key}.${NestedDocumentKeys<NonNullable<ModelDocument<Shape>[Key]>>}`
      : never
    : never;
}[Extract<keyof Shape, string>];

/** Visible field paths accepted by `.fields()`. */
export type SelectableKey<Shape extends SchemaShape> =
  | Exclude<Extract<keyof ModelDocument<Shape>, string>, '_id' | HiddenDocumentKey<Shape>>
  | NestedSelectableKey<Shape>;

type PathSelection<Value, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof Value
    ? { [Key in Head]: PathSelection<NonNullable<Value[Head]>, Tail> }
    : never
  : Path extends keyof Value
    ? Pick<Value, Path>
    : never;

/** Projected result type that preserves the structure of selected nested paths. */
export type SelectedDocument<Shape extends SchemaShape, Key extends SelectableKey<Shape>> = [
  Key,
] extends [never]
  ? VisibleDocument<Shape>
  : Simplify<
      Pick<ModelDocument<Shape>, '_id'> &
        UnionToIntersection<PathSelection<ModelDocument<Shape>, Extract<Key, string>>>
    >;

/** Field directives accepted by query and population projections. */
export type FieldSelection<Shape extends SchemaShape> =
  | SelectableKey<Shape>
  | '$all'
  | `+${Extract<HiddenDocumentKey<Shape>, string>}`;

type FieldValues<Fields extends readonly unknown[]> = Fields[number];
type VisibleFieldValues<Fields extends readonly unknown[]> = Exclude<
  FieldValues<Fields>,
  '$all' | `+${string}`
>;
type HiddenFieldValues<Fields extends readonly unknown[]> =
  FieldValues<Fields> extends infer Field
    ? Field extends `+${infer Hidden}`
      ? Hidden
      : never
    : never;

/** Infer a result document from the unified `fields` selector syntax. */
export type FieldsDocument<
  Shape extends SchemaShape,
  Fields extends readonly FieldSelection<Shape>[],
> = Simplify<
  ('$all' extends FieldValues<Fields>
    ? VisibleDocument<Shape>
    : [VisibleFieldValues<Fields>] extends [never]
      ? Pick<ModelDocument<Shape>, '_id'>
      : SelectedDocument<Shape, Extract<VisibleFieldValues<Fields>, SelectableKey<Shape>>>) &
    Pick<ModelDocument<Shape>, Extract<HiddenFieldValues<Fields>, keyof ModelDocument<Shape>>>
>;

export type { HiddenDocumentKey, HiddenKey, VisibleDocument };
