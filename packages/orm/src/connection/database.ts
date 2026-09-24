import {
  MongoClient,
  type Collection,
  type Document,
  type IndexDescription,
  type MongoClientOptions,
  type Db as MongoDatabase,
} from 'mongodb';

import { Model } from '../model/model.js';
import type {
  Schema,
  SchemaOptions,
  SchemaIndex,
  SchemaLike,
  SchemaShape,
  SchemaRelationMap,
  ScopeDefinitions,
} from '../schema/index.js';
import { DatabaseNotConnectedError } from '../validation/errors.js';

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
    for (const [name, schema] of Object.entries(options.schemas ?? {})) {
      this.registerSchema(schema, name);
      let model:
        | Model<SchemaShape, SchemaRelationMap, ScopeDefinitions, any, readonly SchemaIndex<any>[]>
        | undefined;
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
    Options extends SchemaOptions,
    Indexes extends readonly SchemaIndex<any>[],
  >(
    name: string,
    schema: Schema<Shape, Relations, Scopes, Options, Indexes>,
  ): Model<Shape, Relations, Scopes, Options, Indexes> {
    this.registerSchema(schema, name);
    return new Model(this, name, schema);
  }

  private registerSchema(schema: SchemaLike, name: string): void {
    const registeredName = this.schemaCollections.get(schema);
    if (registeredName && registeredName !== name) {
      throw new Error(
        `Schema is already registered with collection "${registeredName}" and cannot also use "${name}"`,
      );
    }
    this.schemaCollections.set(schema, name);
  }

  /** Resolve a registered schema to its MongoDB collection. */
  collectionFor(schema: SchemaLike): Collection<Document> {
    const name = this.schemaCollections.get(schema);
    if (!name) throw new Error('Schema is not registered with this database');
    return this.native.collection<Document>(name);
  }

  /** Explicitly create all indexes declared by registered schemas. */
  async sync(options: { dropIndexes?: boolean } = {}): Promise<Record<string, string[]>> {
    const synchronized: Record<string, string[]> = {};
    for (const [schema, name] of this.schemaCollections) {
      const definitions = (schema.indexDefinitions ?? []) as readonly SchemaIndex<any>[];
      if (options.dropIndexes) await this.collectionFor(schema).dropIndexes();
      synchronized[name] = definitions.length
        ? await this.collectionFor(schema).createIndexes(
            definitions.map(({ fields, options: indexOptions }) => ({
              ...(indexOptions as object),
              key: fields,
            })) as IndexDescription[],
          )
        : [];
    }
    return synchronized;
  }

  /** Return the selected database, failing if `connect()` was not called. */
  get native(): MongoDatabase {
    if (!this.database) throw new DatabaseNotConnectedError();
    return this.database;
  }
}

/** Create a disconnected MongoDB database handle. */
export function createDatabase<const Registry extends SchemaRegistry>(
  options: DbOptions<Registry> & { schemas: Registry },
): Db<Registry> & DatabaseModels<Registry>;
export function createDatabase<const Builder extends { readonly __registry?: SchemaRegistry }>(
  options: Omit<DbOptions<RegistryOfBuilder<Builder>>, 'schemas'> & { schemas: Builder },
): Db<RegistryOfBuilder<Builder>> & DatabaseModels<RegistryOfBuilder<Builder>>;
export function createDatabase(options: DbOptions): Db;
export function createDatabase(options: DbOptions): Db {
  return new Db(options);
}
