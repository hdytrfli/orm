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

/** Configuration for a MongoDB connection. */
export interface DbOptions {
  /** MongoDB connection string. */
  uri: string;
  /** Logical database name. */
  database: string;
  /** Optional native MongoDB client options. */
  clientOptions?: MongoClientOptions;
}

/** Owns a MongoDB client and creates schema-bound models. */
export class Db {
  private readonly client: MongoClient;
  private database: MongoDatabase | null = null;
  private readonly schemaCollections = new Map<SchemaLike, string>();

  /** Create a disconnected database handle. */
  constructor(private readonly options: DbOptions) {
    this.client = new MongoClient(options.uri, options.clientOptions);
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
export const createDatabase = (options: DbOptions): Db => new Db(options);
