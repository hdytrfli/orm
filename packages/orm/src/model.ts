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
  SchemaRelationMap,
  SchemaShape,
  ScopeDefinitions,
} from './schema/index.js';

type UpdateInput<Shape extends SchemaShape> = Partial<Omit<InferShape<Schema<Shape>>, '_id'>>;
/** A MongoDB collection with CRUD operations derived from a schema. */
export class Model<
  Shape extends SchemaShape,
  Relations extends SchemaRelationMap = {},
  Scopes extends ScopeDefinitions = {},
> {
  /** Create a model bound to a database collection and schema. */
  constructor(
    private readonly db: Db,
    readonly name: string,
    private readonly schema: Schema<Shape, Relations, Scopes>,
  ) {}

  private get collection(): Collection<StoredDocument<Shape>> {
    return this.db.native.collection<StoredDocument<Shape>>(this.name);
  }

  /** Validate and insert one document, generating its ObjectId. */
  async create(input: InferShape<Schema<Shape>>): Promise<Infer<Schema<Shape>>> {
    const document = {
      _id: new ObjectId(),
      ...this.schema.parse(input),
    } as Infer<Schema<Shape>>;
    await this.collection.insertOne(
      document as unknown as OptionalUnlessRequiredId<StoredDocument<Shape>>,
    );
    return document;
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
    );
  }

  /** Validate and apply a partial update to the first matching document. */
  async update(
    filter: ModelFilter<Shape>,
    patch: UpdateInput<Shape>,
  ): Promise<Infer<Schema<Shape>> | null> {
    const parsedPatch = this.schema.parsePartial(patch);
    return (await this.collection.findOneAndUpdate(
      filter as MongoFilter<StoredDocument<Shape>>,
      { $set: parsedPatch } as UpdateFilter<StoredDocument<Shape>>,
      { returnDocument: 'after' },
    )) as unknown as Infer<Schema<Shape>> | null;
  }

  /** Delete every document matching a MongoDB filter. */
  delete(filter: ModelFilter<Shape>): Promise<DeleteResult> {
    return this.collection.deleteMany(filter as MongoFilter<StoredDocument<Shape>>);
  }
}
