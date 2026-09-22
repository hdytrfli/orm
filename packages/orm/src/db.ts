import {
  MongoClient,
  type Collection,
  type Document,
  type MongoClientOptions,
  type Db as MongoDatabase,
} from 'mongodb';

import { DatabaseNotConnectedError } from './errors/errors.js';
import { Model } from './model.js';
import type {
  Schema,
  SchemaLike,
  SchemaShape,
  SchemaRelationMap,
  ScopeDefinitions,
} from './schema/index.js';
import type { SchemaRegistryBuilder } from './schema/registry.js';

export type SchemaRegistry = Record<string, SchemaLike>;

/** Configuration for a MongoDB connection. */
export interface DbOptions<Registry extends SchemaRegistry = SchemaRegistry> {
  /** MongoDB connection string. */
  uri: string;
  /** Logical database name. */
  database: string;
  /** Optional native MongoDB client options. */
  clientOptions?: MongoClientOptions;
  /** Schemas registered as plural database model properties. */
  schema?: Registry;
}

type ModelForSchema<SchemaType> =
  SchemaType extends Schema<infer Shape, infer Relations, infer Scopes>
    ? Model<Shape, Relations, Scopes>
    : never;

export type DatabaseModels<Registry extends SchemaRegistry> = {
  readonly [Name in keyof Registry]: ModelForSchema<Registry[Name]>;
};

type RegistryOfBuilder<Builder extends { readonly __registry?: SchemaRegistry }> = NonNullable<
  Builder['__registry']
>;

/** Owns a MongoDB client and creates schema-bound models. */
export class Db<Registry extends SchemaRegistry = SchemaRegistry> {
  private readonly client: MongoClient;
  private database: MongoDatabase | null = null;
  private readonly schemaCollections = new Map<SchemaLike, string>();

  /** Create a disconnected database handle. */
  constructor(private readonly options: DbOptions<Registry>) {
    this.client = new MongoClient(options.uri, options.clientOptions);
    for (const [name, schema] of Object.entries(options.schema ?? {})) {
      this.schemaCollections.set(schema, name);
      let model: Model<SchemaShape, SchemaRelationMap, ScopeDefinitions> | undefined;
      Object.defineProperty(this, name, {
        configurable: false,
        enumerable: true,
        get: () => (model ??= this.model(name, schema)),
      });
    }
  }

  /** Connect to MongoDB and select the configured database. */
  async connect(): Promise<void> {
    await this.client.connect();
    this.database = this.client.db(this.options.database);
  }

  /** Close the MongoDB client and release its resources. */
  async disconnect(): Promise<void> {
    await this.client.close();
    this.database = null;
  }

  /** Create a model bound to a MongoDB collection and schema. */
  model<
    Shape extends SchemaShape,
    Relations extends SchemaRelationMap,
    Scopes extends ScopeDefinitions,
  >(name: string, schema: Schema<Shape, Relations, Scopes>): Model<Shape, Relations, Scopes> {
    this.schemaCollections.set(schema, name);
    return new Model(this, name, schema);
  }

  /** Resolve a registered schema to its MongoDB collection. */
  collectionFor(schema: SchemaLike): Collection<Document> {
    const name = this.schemaCollections.get(schema);
    if (!name) throw new Error('Schema is not registered with this database');
    return this.native.collection<Document>(name);
  }

  /** Return the selected database, failing if `connect()` was not called. */
  get native(): MongoDatabase {
    if (!this.database) throw new DatabaseNotConnectedError();
    return this.database;
  }
}

/** Create a disconnected MongoDB database handle. */
export function createDatabase<const Registry extends SchemaRegistry>(
  options: DbOptions<Registry> & { schema: Registry },
): Db<Registry> & DatabaseModels<Registry>;
export function createDatabase<const Builder extends { readonly __registry?: SchemaRegistry }>(
  options: Omit<DbOptions<RegistryOfBuilder<Builder>>, 'schema'> & { schema: Builder },
): Db<RegistryOfBuilder<Builder>> & DatabaseModels<RegistryOfBuilder<Builder>>;
export function createDatabase(options: DbOptions): Db;
export function createDatabase(options: DbOptions): Db {
  return new Db(options);
}
