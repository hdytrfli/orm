import type { Schema } from './schema.js';

/** Extract the relation map from a schema type. */
export type SchemaRelationsOf<SchemaType> =
  SchemaType extends Schema<any, infer Relations, any, any, any, any> ? Relations : {};

/** Extract the virtual map from a schema type. */
export type SchemaVirtualsOf<SchemaType> =
  SchemaType extends Schema<any, any, any, any, any, infer Virtuals> ? Virtuals : {};

type ExtendSchema<SchemaType, AddedRelations = {}, AddedScopes = {}, AddedVirtuals = {}> =
  SchemaType extends Schema<
    infer Shape,
    infer Relations,
    infer Scopes,
    infer Options,
    infer Indexes,
    infer Virtuals
  >
    ? Schema<
        Shape,
        Relations & AddedRelations,
        Scopes & AddedScopes,
        Options,
        Indexes,
        Virtuals & AddedVirtuals
      >
    : SchemaType;

/** Preserve a schema's configuration while adding relation metadata. */
export type WithSchemaRelations<SchemaType, Relations> = ExtendSchema<SchemaType, Relations>;

/** Preserve a schema's configuration while adding population scopes. */
export type WithSchemaScopes<SchemaType, Scopes> = ExtendSchema<SchemaType, {}, Scopes>;

/** Preserve a schema's configuration while adding virtual relations. */
export type WithSchemaVirtuals<SchemaType, Virtuals> = ExtendSchema<SchemaType, {}, {}, Virtuals>;
