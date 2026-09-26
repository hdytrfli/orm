import type { MongoClientOptions } from 'mongodb';

import type { ModelFromSchema } from '../model/extractors.js';
import type { SchemaLike } from '../schema/index.js';

/** Schema registry supplied to a database handle. */
export type SchemaRegistry = Record<string, SchemaLike>;

/** Configuration for a MongoDB connection and its registered collections. */
export interface DbOptions<Registry extends SchemaRegistry> {
  /** MongoDB connection string. */
  uri: string;
  /** Logical database name. */
  database: string;
  /** Optional native MongoDB client options. */
  clientOptions?: MongoClientOptions;
  /** Registered schemas, exposed as matching model properties and collection names. */
  schemas: Registry;
}

/** Model properties generated from a schema registry. */
export type DatabaseModels<Registry extends SchemaRegistry> = {
  readonly [Name in keyof Registry]: ModelFromSchema<Registry[Name]>;
};
