export { ObjectId } from 'mongodb';
export { orm } from './api.js';
export type { OrmApi } from './api.js';
export { Schema } from './schema/index.js';
export type { Infer, InferInput, InferShape } from './schema/index.js';
export type { SchemaDefinition, SchemaShape } from './schema/index.js';
export type { ManagedField, SchemaOptions } from './schema/index.js';
export { hasSoftDelete } from './schema/index.js';
export type { SoftDeleteEnabled } from './schema/index.js';
export type {
  RefDefinition,
  RefField,
  RelationMap,
  SchemaLike,
  SchemaRelation,
  SchemaRelationMap,
} from './schema/index.js';
export { createDatabase, Db } from './connection/database.js';
export type {
  RelationDefinitions,
  SchemaRegistryBuilder,
  ScopeDefinitionsBySchema,
} from './relations/registry.js';
export {
  CursorQueryError,
  DatabaseNotConnectedError,
  EstimatedCountError,
  InvalidQueryError,
  OrmError,
} from './validation/errors.js';
export { Model } from './model/model.js';
export { ModelCursor, ModelQuery } from './query/query.js';
export type {
  HiddenDocumentKey,
  ModelFilter,
  ModelSort,
  PopulateSpec,
  PopulateSpecs,
  PopulatedResult,
  SelectedDocument,
  SelectableKey,
  StoredDocument,
  VisibleDocument,
} from './query/query.js';
export type { DatabaseModels, DbOptions, SchemaRegistry } from './connection/database.js';
