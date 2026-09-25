import type { ObjectId } from 'mongodb';

import type {
  Infer,
  InferInput,
  Schema,
  SchemaIndex,
  SchemaIndexNames,
  SchemaOptions,
  SchemaRelationMap,
  SchemaShape,
  ScopeDefinitions,
} from '../schema/index.js';

export type CreateInput<Shape extends SchemaShape, Options extends SchemaOptions> = Omit<
  InferInput<Schema<Shape, {}, {}, Options>>,
  '_id'
>;

export type UpdateInput<Shape extends SchemaShape, Options extends SchemaOptions> = Partial<
  Omit<InferInput<Schema<Shape, {}, {}, Options>>, '_id'>
>;

/** Equality-only upsert filter that can seed the inserted document. */
export type UpsertFilter<Shape extends SchemaShape, Options extends SchemaOptions> = Partial<
  InferInput<Schema<Shape, {}, {}, Options>>
> & { _id?: ObjectId };

/** Required create fields not already supplied as equality fields in the upsert filter. */
export type UpsertData<Shape extends SchemaShape, Options extends SchemaOptions, Filter> = Omit<
  CreateInput<Shape, Options>,
  keyof Filter
>;

export type ModelResult<
  Shape extends SchemaShape,
  Relations extends SchemaRelationMap,
  Scopes extends ScopeDefinitions,
  Options extends SchemaOptions,
> = Infer<Schema<Shape, Relations, Scopes, Options>>;

export type IndexNames<Indexes extends readonly SchemaIndex<any>[]> = SchemaIndexNames<Indexes>;

export type IndexManager<Indexes extends readonly SchemaIndex<any>[]> = {
  readonly drop: (names: readonly IndexNames<Indexes>[]) => Promise<void>;
  readonly purge: () => Promise<void>;
};
