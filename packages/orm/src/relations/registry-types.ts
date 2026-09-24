import type { ObjectId } from 'mongodb';

import type { PopulateSpecs } from '../query/index.js';
import type { SchemaShape, ScopeDefinitions } from '../schema/contracts.js';
import type { SchemaIndex } from '../schema/indexes.js';
import type { InferShape } from '../schema/inference.js';
import type { Schema } from '../schema/schema.js';
import type { SchemaRelation, SchemaLike } from './definitions.js';

type ObjectIdKeys<Shape extends SchemaShape> = {
  [Key in keyof InferShape<Schema<Shape>>]-?: NonNullable<
    InferShape<Schema<Shape>>[Key]
  > extends ObjectId
    ? Key
    : never;
}[keyof InferShape<Schema<Shape>>];

/** Valid local ObjectId fields and targets accepted by `defineRelations`. */
export type RelationDefinitions<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Registry[Name] extends Schema<infer Shape, any, any, any>
    ? Partial<Record<Extract<ObjectIdKeys<Shape>, string>, Extract<keyof Registry, string>>>
    : never;
};

type RelationsFor<
  Registry extends Record<string, SchemaLike>,
  AllDefinitions extends RelationDefinitions<Registry>,
  Definitions,
> = {
  [Field in keyof Definitions & string]: Definitions[Field] extends keyof Registry
    ? SchemaRelation<
        Registry[Definitions[Field]],
        Field,
        '_id',
        RelationsFor<Registry, AllDefinitions, NonNullable<AllDefinitions[Definitions[Field]]>>
      >
    : never;
};

type RegistryWithRelations<
  Registry extends Record<string, SchemaLike>,
  Definitions extends RelationDefinitions<Registry>,
> = {
  [Name in keyof Registry]: Registry[Name] extends Schema<
    infer Shape,
    infer Relations,
    infer Scopes,
    infer Options
  >
    ? Schema<
        Shape,
        Relations & RelationsFor<Registry, Definitions, NonNullable<Definitions[Name]>>,
        Scopes,
        Options,
        Registry[Name] extends Schema<
          any,
          any,
          any,
          any,
          infer Indexes extends readonly SchemaIndex<any>[]
        >
          ? Indexes
          : []
      >
    : Registry[Name];
};

type RelationMapOf<Value> =
  Value extends SchemaRelation<any, any, any, infer Relations>
    ? Relations
    : Value extends Schema<any, infer Relations, any, any>
      ? Relations
      : {};

/** Scope declarations accepted for each registered model. */
export type ScopeDefinitionsBySchema<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Record<string, PopulateSpecs<RelationMapOf<Registry[Name]>>>;
};

type RegistryWithScopes<
  Registry extends Record<string, SchemaLike>,
  Definitions extends ScopeDefinitionsBySchema<Registry>,
> = {
  [Name in keyof Registry]: Registry[Name] extends Schema<
    infer Shape,
    infer Relations,
    infer Scopes,
    infer Options
  >
    ? Schema<
        Shape,
        Relations,
        Scopes & (Definitions[Name] extends ScopeDefinitions ? Definitions[Name] : {}),
        Options,
        Registry[Name] extends Schema<
          any,
          any,
          any,
          any,
          infer Indexes extends readonly SchemaIndex<any>[]
        >
          ? Indexes
          : []
      >
    : Registry[Name];
};

/** Typed registry builder API, with relations and scopes reflected in model types. */
export type SchemaRegistryBuilder<Registry extends Record<string, SchemaLike>> = Registry & {
  readonly __registry?: Registry;
  defineRelations<const Definitions extends RelationDefinitions<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithRelations<Registry, Definitions>>;
  defineScopes<const Definitions extends ScopeDefinitionsBySchema<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithScopes<Registry, Definitions>>;
};
