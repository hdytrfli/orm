import { type Condition, type Document, type ObjectId, type RootFilterOperators } from 'mongodb';

import type { SchemaShape } from '../../schema/contracts.js';
import type { ModelDocument, StoredDocument } from './document.js';

export type NestedFilterKey<Value, Prefix extends string = ''> = Value extends object
  ? Value extends ObjectId | Date | readonly unknown[]
    ? never
    : {
        [Key in Extract<keyof Value, string>]: NonNullable<Value[Key]> extends object
          ? `${Prefix}${Key}` | `${Prefix}${Key}.${NestedFilterKey<NonNullable<Value[Key]>>}`
          : `${Prefix}${Key}`;
      }[Extract<keyof Value, string>]
  : never;

type NestedFilterValue<Value, Path extends string> = Path extends `${infer Head}.${infer Tail}`
  ? Head extends keyof Value
    ? NestedFilterValue<NonNullable<Value[Head]>, Tail>
    : never
  : Path extends keyof Value
    ? Value[Path]
    : never;

type FilterForDocument<DocumentShape extends Document, FieldShape extends object> = Partial<{
  [Key in keyof FieldShape]: Condition<FieldShape[Key]>;
}> &
  Partial<{
    [Path in NestedFilterKey<FieldShape>]: Condition<NestedFilterValue<FieldShape, Path>>;
  }> &
  Partial<
    Pick<
      RootFilterOperators<DocumentShape>,
      '$comment' | '$expr' | '$jsonSchema' | '$text' | '$where'
    >
  > & {
    $and?: FilterForDocument<DocumentShape, FieldShape>[];
    $nor?: FilterForDocument<DocumentShape, FieldShape>[];
    $or?: FilterForDocument<DocumentShape, FieldShape>[];
  };

/** Schema-checked MongoDB filters, including nested dot-notation paths. */
export type ModelFilter<Shape extends SchemaShape> = FilterForDocument<
  StoredDocument<Shape>,
  ModelDocument<Shape>
>;

/** MongoDB sort directions supported by the model query API. */
export type SortDirection = 'asc' | 'desc';

/** Schema-checked sort specifications. */
export type ModelSort<Shape extends SchemaShape> = Partial<
  Record<Extract<keyof ModelDocument<Shape>, string>, SortDirection>
>;
