import {
  MongoClient,
  type Collection,
  type Document,
  type IndexDescription,
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
  SchemaVirtualMap,
  ScopeDefinitions,
} from '../schema/index.js';
import { DatabaseNotConnectedError, SchemaConfigurationError } from '../validation/errors.js';
import type { DatabaseModels, DbOptions, SchemaRegistry } from './types.js';

export type { DatabaseModels, DbOptions, SchemaRegistry } from './types.js';

/** Options for operations that intentionally bypass schema-level safeguards. */
export interface UnsafePurgeOptions {
  /** Suppress the destructive-operation warning. Defaults to `false`. */
  quiet?: boolean;
}

/** Owns a MongoDB client and creates schema-bound models. */
export class Db<Registry extends SchemaRegistry = SchemaRegistry> {
  private readonly client: MongoClient;
  private database: MongoDatabase | null = null;
  private readonly schemaCollections = new Map<SchemaLike, string>();

  /** Destructive database operations that bypass model-level behavior. */
  readonly unsafe = {
    purge: async (options: UnsafePurgeOptions = {}): Promise<number> => {
      if (!options.quiet) {
        console.warn(
          '[mongorm] db.unsafe.purge() permanently deletes every document from all registered collections.',
        );
      }

      const collectionNames = new Set(this.schemaCollections.values());
      const results = await Promise.all(
        [...collectionNames].map((name) => this.native.collection(name).deleteMany({})),
      );
      return results.reduce((total, result) => total + result.deletedCount, 0);
    },
  };

  /** Create a disconnected database handle. */
  constructor(private readonly options: DbOptions<Registry>) {
    this.client = new MongoClient(options.uri, options.clientOptions);
    for (const [name, schema] of Object.entries(options.schemas)) {
      this.registerSchema(schema, name);
      let model:
        | Model<
            SchemaShape,
            SchemaRelationMap,
            ScopeDefinitions,
            any,
            readonly SchemaIndex<any>[],
            SchemaVirtualMap
          >
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
    Virtuals extends SchemaVirtualMap,
  >(
    name: string,
    schema: Schema<Shape, Relations, Scopes, Options, Indexes, Virtuals>,
  ): Model<Shape, Relations, Scopes, Options, Indexes, Virtuals> {
    this.registerSchema(schema, name);
    return new Model(this, name, schema);
  }

  private registerSchema(schema: SchemaLike, name: string): void {
    const registeredName = this.schemaCollections.get(schema);
    if (registeredName && registeredName !== name) {
      throw new SchemaConfigurationError(
        `Schema is already registered with collection "${registeredName}" and cannot also use "${name}". Use separate schema instances for separate collections.`,
      );
    }
    this.schemaCollections.set(schema, name);
  }

  /** Resolve a registered schema to its MongoDB collection. */
  collectionFor(schema: SchemaLike): Collection<Document> {
    const name = this.schemaCollections.get(schema);
    if (!name) {
      throw new SchemaConfigurationError(
        'Schema is not registered with this database. Add it to createDatabase({ schemas }) or register it with db.model().',
      );
    }
    return this.native.collection<Document>(name);
  }

  /** Explicitly create all indexes declared by registered schemas. */
  async sync(
    options: { dropIndexes?: boolean; quiet?: boolean } = {},
  ): Promise<Record<string, string[]>> {
    if (options.dropIndexes && !options.quiet) {
      console.warn(
        '[mongorm] db.sync({ dropIndexes: true }) drops indexes from every registered collection before recreating declared indexes.',
      );
    }
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

type DatabaseSchemaInput = SchemaRegistry | { readonly __registry?: SchemaRegistry };

type RegistryFromBuilder<Input> = Input extends { readonly __registry?: infer Registry }
  ? NonNullable<Registry> extends SchemaRegistry
    ? NonNullable<Registry>
    : SchemaRegistry
  : SchemaRegistry;

type RegistryFromInput<Input> = '__registry' extends keyof Input
  ? RegistryFromBuilder<Input>
  : Input extends SchemaRegistry
    ? Input
    : SchemaRegistry;

type DatabaseFromInput<Input> = Db<RegistryFromInput<Input>> &
  DatabaseModels<RegistryFromInput<Input>>;

/** Create a disconnected MongoDB database handle with models inferred from its schemas. */
export const createDatabase = <const Schemas extends DatabaseSchemaInput>(options: {
  uri: string;
  database: string;
  clientOptions?: DbOptions<SchemaRegistry>['clientOptions'];
  schemas: Schemas;
}): DatabaseFromInput<Schemas> =>
  new Db(options as DbOptions<RegistryFromInput<Schemas>>) as DatabaseFromInput<Schemas>;
