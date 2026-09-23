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
import type {
  Infer,
  InferShape,
  Schema,
  ManagedField,
  SchemaOptions,
  SchemaRelationMap,
  SchemaShape,
  ScopeDefinitions,
} from './schema/index.js';

type ManagedKeys<Options extends SchemaOptions> = ManagedField<Options>;
type CreateInput<Shape extends SchemaShape, Options extends SchemaOptions> = Omit<
  InferShape<Schema<Shape, {}, {}, Options>>,
  '_id' | ManagedKeys<Options>
>;
type UpdateInput<Shape extends SchemaShape, Options extends SchemaOptions> = Partial<
  Omit<InferShape<Schema<Shape, {}, {}, Options>>, '_id' | ManagedKeys<Options>>
>;
/** A MongoDB collection with CRUD operations derived from a schema. */
export class Model<
  Shape extends SchemaShape,
  Relations extends SchemaRelationMap = {},
  Scopes extends ScopeDefinitions = {},
  Options extends SchemaOptions = {},
> {
  /** Create a model bound to a database collection and schema. */
  constructor(
    private readonly db: Db,
    readonly name: string,
    private readonly schema: Schema<Shape, Relations, Scopes, Options>,
  ) {}

  private get collection(): Collection<StoredDocument<Shape>> {
    return this.db.native.collection<StoredDocument<Shape>>(this.name);
  }

  private activeFilter(filter: ModelFilter<Shape>): ModelFilter<Shape> {
    return this.schema.optionsConfig.softDelete
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
    if (this.schema.optionsConfig.softDelete) document.deletedAt = null;
    await this.collection.insertOne(
      document as unknown as OptionalUnlessRequiredId<StoredDocument<Shape>>,
    );
    return document as Infer<Schema<Shape, Relations, Scopes, Options>>;
  }

  /** Build a query for all documents matching a MongoDB filter. */
  filter(
    filter: ModelFilter<Shape> = {},
  ): ModelQuery<Shape, VisibleDocument<Shape>, true, Relations, Scopes> {
    return new ModelQuery(
      this.collection,
      filter,
      this.schema.fields,
      this.schema.hiddenFields,
      this.db,
      this.schema.relationMap,
      this.schema.scopeMap,
      Boolean(this.schema.optionsConfig.softDelete),
    );
  }

  /** Build a query for the first document matching a MongoDB filter. */
  find(
    filter: ModelFilter<Shape> = {},
  ): ModelFindQuery<Shape, VisibleDocument<Shape>, Relations, Scopes> {
    return new ModelFindQuery(
      this.collection,
      filter,
      this.schema.fields,
      this.schema.hiddenFields,
      this.db,
      this.schema.relationMap,
      this.schema.scopeMap,
      Boolean(this.schema.optionsConfig.softDelete),
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
  async restore(
    filter: ModelFilter<Shape>,
  ): Promise<Infer<Schema<Shape, Relations, Scopes, Options>> | null> {
    if (!this.schema.optionsConfig.softDelete) {
      throw new Error('Restore requires softDelete schema options');
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
    if (!this.schema.optionsConfig.softDelete) {
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
  forceDelete(filter: ModelFilter<Shape>): Promise<DeleteResult> {
    return this.collection.deleteMany(filter as MongoFilter<StoredDocument<Shape>>);
  }
}
