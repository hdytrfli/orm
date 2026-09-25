import {
  type Collection,
  type DeleteResult,
  type Filter as MongoFilter,
  type OptionalUnlessRequiredId,
  type UpdateFilter,
} from 'mongodb';

import type { Db } from '../connection/database.js';
import { ModelQuery } from '../query/index.js';
import type { ModelFilter, StoredDocument, VisibleDocument } from '../query/index.js';
import { hasSoftDelete } from '../schema/index.js';
import type {
  Schema,
  SchemaIndex,
  SchemaOptions,
  SoftDeleteEnabled,
  SchemaRelationMap,
  SchemaShape,
  ScopeDefinitions,
} from '../schema/index.js';
import { SchemaConfigurationError } from '../validation/errors.js';
import { prepareDocument } from './document.js';
import { applySoftDeleteFilter } from './soft-delete.js';
import type {
  CreateInput,
  IndexManager,
  IndexNames,
  ModelResult,
  UpdateInput,
  UpsertData,
  UpsertFilter,
} from './types.js';
/** A MongoDB collection with CRUD operations derived from a schema. */
export class Model<
  Shape extends SchemaShape,
  Relations extends SchemaRelationMap = {},
  Scopes extends ScopeDefinitions = {},
  Options extends SchemaOptions = {},
  Indexes extends readonly SchemaIndex<any>[] = [],
> {
  declare readonly index: IndexManager<Indexes>;
  declare readonly bulk: {
    create: (
      inputs: readonly CreateInput<Shape, Options>[],
    ) => Promise<ModelResult<Shape, Relations, Scopes, Options>[]>;
  };
  declare readonly restore: SoftDeleteEnabled<Options> extends true
    ? (filter: ModelFilter<Shape>) => Promise<ModelResult<Shape, Relations, Scopes, Options> | null>
    : never;
  declare readonly purge: SoftDeleteEnabled<Options> extends true
    ? (filter: ModelFilter<Shape>) => Promise<DeleteResult>
    : never;

  /** Create a model bound to a database collection and schema. */
  constructor(
    private readonly db: Db,
    readonly name: string,
    private readonly schema: Schema<Shape, Relations, Scopes, Options, Indexes>,
  ) {
    Object.defineProperty(this, 'bulk', {
      configurable: false,
      enumerable: false,
      value: {
        create: (inputs: readonly CreateInput<Shape, Options>[]) => this.bulkCreate(inputs),
      },
    });
    Object.defineProperty(this, 'index', {
      configurable: false,
      enumerable: false,
      value: {
        drop: (names: readonly IndexNames<Indexes>[]) => this.dropIndexes(names),
        purge: () => this.collection.dropIndexes(),
      },
    });
    if (hasSoftDelete(schema.optionsConfig)) {
      Object.defineProperties(this, {
        restore: {
          configurable: false,
          enumerable: false,
          value: (filter: ModelFilter<Shape>) => this.restoreDocument(filter),
        },
        purge: {
          configurable: false,
          enumerable: false,
          value: (filter: ModelFilter<Shape>) => this.purgeDocuments(filter),
        },
      });
    }
  }

  private get collection(): Collection<StoredDocument<Shape>> {
    return this.db.native.collection<StoredDocument<Shape>>(this.name);
  }

  private async dropIndexes(names: readonly IndexNames<Indexes>[]): Promise<void> {
    await Promise.all(names.map((name) => this.collection.dropIndex(name)));
  }

  private activeFilter(filter: ModelFilter<Shape>): ModelFilter<Shape> {
    if (!hasSoftDelete(this.schema.optionsConfig)) return filter;
    return applySoftDeleteFilter(filter, 'active');
  }

  /** Validate and insert one document, generating its ObjectId. */
  async create(
    input: CreateInput<Shape, Options>,
  ): Promise<ModelResult<Shape, Relations, Scopes, Options>> {
    const document = prepareDocument(this.schema, input);
    await this.collection.insertOne(
      document as unknown as OptionalUnlessRequiredId<StoredDocument<Shape>>,
    );
    return document as ModelResult<Shape, Relations, Scopes, Options>;
  }

  private async bulkCreate(
    inputs: readonly CreateInput<Shape, Options>[],
  ): Promise<ModelResult<Shape, Relations, Scopes, Options>[]> {
    if (inputs.length === 0) return [];
    const documents = inputs.map((input) => prepareDocument(this.schema, input));
    await this.collection.insertMany(
      documents as unknown as OptionalUnlessRequiredId<StoredDocument<Shape>>[],
    );
    return documents as ModelResult<Shape, Relations, Scopes, Options>[];
  }

  /** Build a query for all documents matching a MongoDB filter. */
  find(
    filter: ModelFilter<Shape> = {},
  ): ModelQuery<
    Shape,
    VisibleDocument<Shape>,
    true,
    Relations,
    Scopes,
    'none',
    SoftDeleteEnabled<Options>
  > {
    return new ModelQuery(
      this.collection,
      filter,
      this.schema.fields,
      this.schema.hiddenFields,
      this.db,
      this.schema.relationMap,
      this.schema.scopeMap,
      hasSoftDelete(this.schema.optionsConfig),
    );
  }

  /** Validate and apply a partial update to the first matching document. */
  async update(
    filter: ModelFilter<Shape>,
    patch: UpdateInput<Shape, Options>,
  ): Promise<ModelResult<Shape, Relations, Scopes, Options> | null> {
    const parsedPatch = this.schema.parsePartial(patch) as Record<string, unknown>;
    const managedFields = new Set(['createdAt', 'updatedAt', 'deletedAt']);
    for (const field of managedFields) {
      delete parsedPatch[field];
    }
    if (this.schema.optionsConfig.timestamps) parsedPatch.updatedAt = new Date();
    return (await this.collection.findOneAndUpdate(
      this.activeFilter(filter) as MongoFilter<StoredDocument<Shape>>,
      { $set: parsedPatch } as unknown as UpdateFilter<StoredDocument<Shape>>,
      { returnDocument: 'after' },
    )) as unknown as ModelResult<Shape, Relations, Scopes, Options> | null;
  }

  /** Insert a validated document when no active match exists, or set its fields on a match. */
  async upsert<const Filter extends UpsertFilter<Shape, Options>>(
    filter: Filter & Record<Exclude<keyof Filter, keyof UpsertFilter<Shape, Options>>, never>,
    data: UpsertData<Shape, Options, Filter>,
  ): Promise<ModelResult<Shape, Relations, Scopes, Options>> {
    const document = prepareDocument(
      this.schema,
      { ...filter, ...data } as CreateInput<Shape, Options>,
      false,
    );
    const insert: Record<string, unknown> = {};
    if (this.schema.optionsConfig.timestamps) insert.createdAt = document.createdAt;
    if (hasSoftDelete(this.schema.optionsConfig)) insert.deletedAt = document.deletedAt;
    if (this.schema.optionsConfig.timestamps) delete document.createdAt;
    if (hasSoftDelete(this.schema.optionsConfig)) delete document.deletedAt;
    for (const field of Object.keys(filter)) delete document[field];

    return (await this.collection.findOneAndUpdate(
      this.activeFilter(filter as unknown as ModelFilter<Shape>) as MongoFilter<
        StoredDocument<Shape>
      >,
      {
        $set: document,
        $setOnInsert: insert,
      } as unknown as UpdateFilter<StoredDocument<Shape>>,
      { returnDocument: 'after', upsert: true },
    )) as unknown as ModelResult<Shape, Relations, Scopes, Options>;
  }

  /** Restore matching soft-deleted documents. */
  private async restoreDocument(
    filter: ModelFilter<Shape>,
  ): Promise<ModelResult<Shape, Relations, Scopes, Options> | null> {
    if (!hasSoftDelete(this.schema.optionsConfig)) {
      throw new SchemaConfigurationError(
        'Cannot restore documents because soft deletion is disabled. Enable it with schema.options({ softdelete: true }).',
      );
    }
    const patch: Record<string, unknown> = { deletedAt: null };
    if (this.schema.optionsConfig.timestamps) patch.updatedAt = new Date();
    return (await this.collection.findOneAndUpdate(
      applySoftDeleteFilter(filter, 'deleted') as MongoFilter<StoredDocument<Shape>>,
      { $set: patch } as UpdateFilter<StoredDocument<Shape>>,
      { returnDocument: 'after' },
    )) as unknown as ModelResult<Shape, Relations, Scopes, Options> | null;
  }

  /** Delete every document matching a MongoDB filter. */
  async delete(filter: ModelFilter<Shape>): Promise<DeleteResult> {
    if (!hasSoftDelete(this.schema.optionsConfig)) {
      return this.collection.deleteMany(filter as MongoFilter<StoredDocument<Shape>>);
    }

    const patch: Record<string, unknown> = { deletedAt: new Date() };
    if (this.schema.optionsConfig.timestamps) patch.updatedAt = new Date();
    const result = await this.collection.updateMany(
      applySoftDeleteFilter(filter, 'active') as MongoFilter<StoredDocument<Shape>>,
      { $set: patch } as UpdateFilter<StoredDocument<Shape>>,
    );
    return {
      acknowledged: result.acknowledged,
      deletedCount: result.modifiedCount,
    };
  }

  /** Permanently delete matching documents, including soft-deleted documents. */
  private purgeDocuments(filter: ModelFilter<Shape>): Promise<DeleteResult> {
    return this.collection.deleteMany(filter as MongoFilter<StoredDocument<Shape>>);
  }
}
