import {
  ObjectId,
  type Collection,
  type DeleteResult,
  type Document,
  type Filter as MongoFilter,
  type OptionalUnlessRequiredId,
  type UpdateFilter,
} from 'mongodb';

import type { Db } from './db.js';
import type { Infer, InferShape, Schema, SchemaShape } from './schema/index.js';

type StoredDocument<Shape extends SchemaShape> = Infer<Schema<Shape>> & Document;
type UpdateInput<Shape extends SchemaShape> = Partial<Omit<InferShape<Schema<Shape>>, '_id'>>;
type ModelFilter<Shape extends SchemaShape> = Partial<Infer<Schema<Shape>>>;

/** A MongoDB collection with CRUD operations derived from a schema. */
export class Model<Shape extends SchemaShape> {
  /** Create a model bound to a database collection and schema. */
  constructor(
    private readonly db: Db,
    readonly name: string,
    private readonly schema: Schema<Shape>,
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

  /** Return all documents matching a MongoDB filter. */
  async filter(filter: ModelFilter<Shape> = {}): Promise<Infer<Schema<Shape>>[]> {
    return (await this.collection
      .find(filter as MongoFilter<StoredDocument<Shape>>)
      .toArray()) as unknown as Infer<Schema<Shape>>[];
  }

  /** Return the first matching document, or `null` when none exists. */
  async find(filter: ModelFilter<Shape> = {}): Promise<Infer<Schema<Shape>> | null> {
    return (await this.collection.findOne(
      filter as MongoFilter<StoredDocument<Shape>>,
    )) as unknown as Infer<Schema<Shape>> | null;
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
