import type { MongoClientOptions } from 'mongodb';

import type { Model } from '../model/model.js';
import type { Schema, SchemaIndex, SchemaLike } from '../schema/index.js';

/** Schema registry supplied to a database handle. */
export type SchemaRegistry = Record<string, SchemaLike>;

/** Configuration for a MongoDB connection and its registered collections. */
export interface DbOptions<Registry extends SchemaRegistry = SchemaRegistry> {
  /** MongoDB connection string. */
  uri: string;
  /** Logical database name. */
  database: string;
  /** Optional native MongoDB client options. */
  clientOptions?: MongoClientOptions;
  /** Registered schemas, exposed as matching model properties and collection names. */
  schemas?: Registry;
}

type ModelForSchema<SchemaType> =
  SchemaType extends Schema<
    infer Shape,
    infer Relations,
    infer Scopes,
    infer Options,
    infer Indexes extends readonly SchemaIndex<any>[]
  >
    ? Model<Shape, Relations, Scopes, Options, Indexes>
    : never;

/** Model properties generated from a schema registry. */
export type DatabaseModels<Registry extends SchemaRegistry> = {
  readonly [Name in keyof Registry]: ModelForSchema<Registry[Name]>;
};

export type RegistryOfBuilder<Builder extends { readonly __registry?: SchemaRegistry }> =
  NonNullable<Builder['__registry']>;
