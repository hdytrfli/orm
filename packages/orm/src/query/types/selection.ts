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

/** Field paths accepted by `.select()`. */
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

export type { HiddenDocumentKey, HiddenKey, VisibleDocument };
