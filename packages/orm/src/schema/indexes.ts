import type { IndexDescription, IndexDirection } from 'mongodb';

import type { ModelFilter } from '../query/types.js';
import type { SchemaShape } from './contracts.js';

type IndexFieldMap<Shape extends SchemaShape> = Record<
  Extract<keyof Shape, string>,
  IndexDirection
>;

/** Non-empty, schema-checked MongoDB index keys. */
export type SchemaIndexFields<Shape extends SchemaShape> = {
  [Key in keyof IndexFieldMap<Shape>]: Pick<IndexFieldMap<Shape>, Key> &
    Partial<Omit<IndexFieldMap<Shape>, Key>>;
}[keyof IndexFieldMap<Shape>];

/** Partial-index filter restricted to this schema's fields and operators. */
export type SchemaPartialFilter<Shape extends SchemaShape> = ModelFilter<Shape>;

export type SchemaIndexOptions<Shape extends SchemaShape> = Omit<
  IndexDescription,
  'key' | 'partialFilterExpression'
> & {
  readonly partialFilterExpression?: SchemaPartialFilter<Shape>;
};

export type SchemaIndex<Shape extends SchemaShape> = {
  readonly fields: SchemaIndexFields<Shape>;
  readonly options?: SchemaIndexOptions<Shape>;
};

type ExactPartialFilter<Shape extends SchemaShape, Filter> = Filter &
  Record<Exclude<keyof Filter, keyof SchemaPartialFilter<Shape>>, never>;

type ValidateIndexDefinition<Shape extends SchemaShape, Definition> = Definition extends {
  readonly options?: infer Options;
}
  ? Definition & {
      readonly options?: Options extends {
        readonly partialFilterExpression?: infer Filter;
      }
        ? Options & {
            readonly partialFilterExpression?: ExactPartialFilter<Shape, Filter>;
          }
        : Options;
    }
  : Definition;

export type ValidateIndexDefinitions<
  Shape extends SchemaShape,
  Definitions extends readonly unknown[],
> = {
  [Key in keyof Definitions]: ValidateIndexDefinition<Shape, Definitions[Key]>;
};

/** Explicit names declared for typed per-model index management. */
export type SchemaIndexNames<Indexes extends readonly SchemaIndex<any>[]> = Extract<
  Indexes[number] extends infer Index
    ? Index extends { readonly options?: { readonly name?: infer Name } }
      ? Name
      : never
    : never,
  string
>;
