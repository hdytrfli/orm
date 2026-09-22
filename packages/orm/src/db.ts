import { MongoClient, type MongoClientOptions, type Db as MongoDatabase } from 'mongodb';

import { Model } from './model.js';
import type { Schema, SchemaShape } from './schema/index.js';

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
  model<Shape extends SchemaShape>(name: string, schema: Schema<Shape>): Model<Shape> {
    return new Model(this, name, schema);
  }

  /** Return the selected database, failing if `connect()` was not called. */
  get native(): MongoDatabase {
    if (!this.database) throw new Error('Database is not connected');
    return this.database;
  }
}

/** Create a disconnected MongoDB database handle. */
export const createDatabase = (options: DbOptions): Db => new Db(options);
