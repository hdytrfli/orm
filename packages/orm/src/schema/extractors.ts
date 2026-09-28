import type {
  SchemaRelationMap,
  SchemaVirtualMap,
  SchemaVirtualDeclarations,
} from '../relations/definitions.js';
import type { SchemaShape, ScopeDefinitions } from './contracts.js';
import type { SchemaIndex } from './indexes.js';
import type { SchemaOptions } from './options.js';
import type { Schema } from './schema.js';

/** Extract the relation map from a schema type. */
export type SchemaRelationsOf<SchemaType> = SchemaType extends {
  readonly __relations: infer Relations;
}
  ? Relations
  : {};

/** Extract schema declarations or resolved bindings from a schema type. */
export type SchemaVirtualsOf<SchemaType> = SchemaType extends {
  readonly __virtuals: infer Virtuals;
}
  ? Virtuals
  : {};

/** Preserve a schema's configuration while adding relation metadata. */
export type WithSchemaRelations<SchemaType, AddedRelations> = SchemaType extends {
  readonly __shape: infer Shape extends SchemaShape;
  readonly __relations: infer Relations extends SchemaRelationMap;
  readonly __scopes: infer Scopes extends ScopeDefinitions;
  readonly __options: infer Options extends SchemaOptions;
  readonly __indexes: infer Indexes extends readonly SchemaIndex<any>[];
  readonly __virtuals: infer Virtuals extends SchemaVirtualDeclarations | SchemaVirtualMap;
}
  ? Schema<Shape, Relations & AddedRelations, Scopes, Options, Indexes, Virtuals>
  : SchemaType;

/** Preserve a schema's configuration while adding population scopes. */
export type WithSchemaScopes<SchemaType, AddedScopes> = SchemaType extends {
  readonly __shape: infer Shape extends SchemaShape;
  readonly __relations: infer Relations extends SchemaRelationMap;
  readonly __scopes: infer Scopes extends ScopeDefinitions;
  readonly __options: infer Options extends SchemaOptions;
  readonly __indexes: infer Indexes extends readonly SchemaIndex<any>[];
  readonly __virtuals: infer Virtuals extends SchemaVirtualDeclarations | SchemaVirtualMap;
}
  ? Schema<Shape, Relations, Scopes & AddedScopes, Options, Indexes, Virtuals>
  : SchemaType;

/** Replace schema declarations with registry-resolved virtual bindings. */
export type WithSchemaVirtuals<SchemaType, Virtuals extends SchemaVirtualMap> = SchemaType extends {
  readonly __shape: infer Shape extends SchemaShape;
  readonly __relations: infer Relations extends SchemaRelationMap;
  readonly __scopes: infer Scopes extends ScopeDefinitions;
  readonly __options: infer Options extends SchemaOptions;
  readonly __indexes: infer Indexes extends readonly SchemaIndex<any>[];
}
  ? Schema<Shape, Relations, Scopes, Options, Indexes, Virtuals>
  : SchemaType;
