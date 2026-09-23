import {
  ObjectId,
  type Collection,
  type DeleteResult,
  type Filter as MongoFilter,
  type OptionalUnlessRequiredId,
  type UpdateFilter,
} from 'mongodb';

import type { Db } from './db.js';
import { ModelFindQuery, ModelQuery } from './query/query.js';
import type { ModelFilter, StoredDocument, VisibleDocument } from './query/query.js';
import { hasSoftDelete } from './schema/index.js';
import type {
  Infer,
  InferInput,
  Schema,
  SchemaOptions,
  SoftDeleteEnabled,
  SchemaRelationMap,
  SchemaShape,
  ScopeDefinitions,
} from './schema/index.js';

type CreateInput<Shape extends SchemaShape, Options extends SchemaOptions> = Omit<
  InferInput<Schema<Shape, {}, {}, Options>>,
  '_id'
>;
type UpdateInput<Shape extends SchemaShape, Options extends SchemaOptions> = Partial<
  Omit<InferInput<Schema<Shape, {}, {}, Options>>, '_id'>
>;
/** A MongoDB collection with CRUD operations derived from a schema. */
export class Model<
  Shape extends SchemaShape,
  Relations extends SchemaRelationMap = {},
  Scopes extends ScopeDefinitions = {},
  Options extends SchemaOptions = {},
> {
  declare readonly restore: SoftDeleteEnabled<Options> extends true
    ? (
        filter: ModelFilter<Shape>,
      ) => Promise<Infer<Schema<Shape, Relations, Scopes, Options>> | null>
    : never;
  declare readonly forceDelete: SoftDeleteEnabled<Options> extends true
    ? (filter: ModelFilter<Shape>) => Promise<DeleteResult>
    : never;

  /** Create a model bound to a database collection and schema. */
  constructor(
    private readonly db: Db,
    readonly name: string,
    private readonly schema: Schema<Shape, Relations, Scopes, Options>,
  ) {
    if (hasSoftDelete(schema.optionsConfig)) {
      Object.defineProperties(this, {
        restore: {
          configurable: false,
          enumerable: false,
          value: (filter: ModelFilter<Shape>) => this.restoreDocument(filter),
        },
        forceDelete: {
          configurable: false,
          enumerable: false,
          value: (filter: ModelFilter<Shape>) => this.forceDeleteDocuments(filter),
        },
      });
    }
  }

  private get collection(): Collection<StoredDocument<Shape>> {
    return this.db.native.collection<StoredDocument<Shape>>(this.name);
  }

  private activeFilter(filter: ModelFilter<Shape>): ModelFilter<Shape> {
    return hasSoftDelete(this.schema.optionsConfig)
      ? ({ $and: [{ deletedAt: null }, filter] } as ModelFilter<Shape>)
      : filter;
  }

  /** Validate and insert one document, generating its ObjectId. */
  async create(
    input: CreateInput<Shape, Options>,
  ): Promise<Infer<Schema<Shape, Relations, Scopes, Options>>> {
    const now = new Date();
    const document: Record<string, unknown> = {
      _id: new ObjectId(),
      ...this.schema.parse(input),
    };
    if (this.schema.optionsConfig.timestamps) {
      document.createdAt = now;
      document.updatedAt = now;
    }
    if (hasSoftDelete(this.schema.optionsConfig)) document.deletedAt = null;
    await this.collection.insertOne(
      document as unknown as OptionalUnlessRequiredId<StoredDocument<Shape>>,
    );
    return document as Infer<Schema<Shape, Relations, Scopes, Options>>;
  }

  /** Build a query for all documents matching a MongoDB filter. */
  filter(
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

  /** Build a query for the first document matching a MongoDB filter. */
  find(
    filter: ModelFilter<Shape> = {},
  ): ModelFindQuery<
    Shape,
    VisibleDocument<Shape>,
    Relations,
    Scopes,
    'none',
    SoftDeleteEnabled<Options>
  > {
    return new ModelFindQuery(
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
  ): Promise<Infer<Schema<Shape, Relations, Scopes, Options>> | null> {
    const parsedPatch = this.schema.parsePartial(patch) as Record<string, unknown>;
    const managedFields = new Set(['createdAt', 'updatedAt', 'deletedAt']);
    managedFields.forEach((field) => delete parsedPatch[field]);
    if (this.schema.optionsConfig.timestamps) parsedPatch.updatedAt = new Date();
    return (await this.collection.findOneAndUpdate(
      this.activeFilter(filter) as MongoFilter<StoredDocument<Shape>>,
      { $set: parsedPatch } as unknown as UpdateFilter<StoredDocument<Shape>>,
      { returnDocument: 'after' },
    )) as unknown as Infer<Schema<Shape, Relations, Scopes, Options>> | null;
  }

  /** Restore matching soft-deleted documents. */
  private async restoreDocument(
    filter: ModelFilter<Shape>,
  ): Promise<Infer<Schema<Shape, Relations, Scopes, Options>> | null> {
    if (!hasSoftDelete(this.schema.optionsConfig)) {
      throw new Error('Restore requires softdelete schema options');
    }
    const patch: Record<string, unknown> = { deletedAt: null };
    if (this.schema.optionsConfig.timestamps) patch.updatedAt = new Date();
    return (await this.collection.findOneAndUpdate(
      { $and: [{ deletedAt: { $ne: null } }, filter] } as MongoFilter<StoredDocument<Shape>>,
      { $set: patch } as UpdateFilter<StoredDocument<Shape>>,
      { returnDocument: 'after' },
    )) as unknown as Infer<Schema<Shape, Relations, Scopes, Options>> | null;
  }

  /** Delete every document matching a MongoDB filter. */
  async delete(filter: ModelFilter<Shape>): Promise<DeleteResult> {
    if (!hasSoftDelete(this.schema.optionsConfig)) {
      return this.collection.deleteMany(filter as MongoFilter<StoredDocument<Shape>>);
    }
    const patch: Record<string, unknown> = { deletedAt: new Date() };
    if (this.schema.optionsConfig.timestamps) patch.updatedAt = new Date();
    const result = await this.collection.updateMany(
      { $and: [{ deletedAt: null }, filter] } as MongoFilter<StoredDocument<Shape>>,
      { $set: patch } as UpdateFilter<StoredDocument<Shape>>,
    );
    return {
      acknowledged: result.acknowledged,
      deletedCount: result.modifiedCount,
    };
  }

  /** Permanently delete matching documents, including soft-deleted documents. */
  private forceDeleteDocuments(filter: ModelFilter<Shape>): Promise<DeleteResult> {
    return this.collection.deleteMany(filter as MongoFilter<StoredDocument<Shape>>);
  }
}
