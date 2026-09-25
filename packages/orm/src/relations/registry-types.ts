import type { ObjectId } from 'mongodb';

import type { PopulateSpecs } from '../query/index.js';
import type { SchemaShape, ScopeDefinitions } from '../schema/contracts.js';
import type { InferShape } from '../schema/inference.js';
import type { Schema } from '../schema/schema.js';
import type { SchemaRelation, SchemaLike, SchemaVirtual } from './definitions.js';

type InferredFields<Shape extends SchemaShape> = InferShape<Schema<Shape>>;

type ObjectIdKeys<Shape extends SchemaShape> = {
  [Key in keyof InferredFields<Shape>]-?: NonNullable<InferredFields<Shape>[Key]> extends ObjectId
    ? Key
    : never;
}[keyof InferredFields<Shape>];

type SchemaVirtuals<Value> =
  Value extends Schema<any, any, any, any, any, infer Virtuals> ? Virtuals : {};

/** Valid local ObjectId fields and targets accepted by `defineRelations`. */
export type RelationDefinitions<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Registry[Name] extends Schema<infer Shape, any, any, any>
    ? Partial<Record<Extract<ObjectIdKeys<Shape>, string>, Extract<keyof Registry, string>>>
    : never;
};

type DocumentKey<Value> = Extract<keyof InferShape<Value>, string> | '_id';

type VirtualTargetInput<
  Registry extends Record<string, SchemaLike>,
  Source extends keyof Registry,
> = {
  [Target in Extract<keyof Registry, string>]: {
    ref: Target;
    localField: DocumentKey<Registry[Source]>;
    foreignField: DocumentKey<Registry[Target]>;
  };
}[Extract<keyof Registry, string>];

/** Virtual relations map a local document field to a foreign target field. */
export type VirtualDefinitions<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Record<string, VirtualTargetInput<Registry, Name>>;
};

type VirtualsFor<
  Registry extends Record<string, SchemaLike>,
  Definitions,
  Name extends keyof Registry,
> = {
  [
    VirtualName in keyof (Name extends keyof Definitions ? NonNullable<Definitions[Name]> : {})
  ]: (Name extends keyof Definitions ? NonNullable<Definitions[Name]> : {})[VirtualName] extends {
    ref: infer Target extends keyof Registry;
    localField: infer Local extends string;
    foreignField: infer Foreign extends string;
  }
    ? SchemaVirtual<Registry[Target], Local, Foreign>
    : never;
};

type RegistryWithVirtuals<
  Registry extends Record<string, SchemaLike>,
  Definitions extends VirtualDefinitions<Registry>,
> = {
  [Name in keyof Registry]: Registry[Name] extends Schema<
    infer Shape,
    infer Relations,
    infer Scopes,
    infer Options,
    infer Indexes,
    infer Existing
  >
    ? Schema<
        Shape,
        Relations,
        Scopes,
        Options,
        Indexes,
        Existing & VirtualsFor<Registry, Definitions, Name>
      >
    : Registry[Name];
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
    infer Options,
    infer Indexes,
    infer Virtuals
  >
    ? Schema<
        Shape,
        Relations & RelationsFor<Registry, Definitions, NonNullable<Definitions[Name]>>,
        Scopes,
        Options,
        Indexes,
        Virtuals
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
  [Name in keyof Registry]?: Record<
    string,
    PopulateSpecs<RelationMapOf<Registry[Name]>, SchemaVirtuals<Registry[Name]>>
  >;
};

type RegistryWithScopes<
  Registry extends Record<string, SchemaLike>,
  Definitions extends ScopeDefinitionsBySchema<Registry>,
> = {
  [Name in keyof Registry]: Registry[Name] extends Schema<
    infer Shape,
    infer Relations,
    infer Scopes,
    infer Options,
    infer Indexes,
    infer Virtuals
  >
    ? Schema<
        Shape,
        Relations,
        Scopes & (Definitions[Name] extends ScopeDefinitions ? Definitions[Name] : {}),
        Options,
        Indexes,
        Virtuals
      >
    : Registry[Name];
};

/** Typed registry builder API, with relations and scopes reflected in model types. */
export type SchemaRegistryBuilder<Registry extends Record<string, SchemaLike>> = Registry & {
  readonly __registry?: Registry;
  defineRelations<const Definitions extends RelationDefinitions<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithRelations<Registry, Definitions>>;
  defineVirtual<const Definitions extends VirtualDefinitions<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithVirtuals<Registry, Definitions>>;
  defineScopes<const Definitions extends ScopeDefinitionsBySchema<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithScopes<Registry, Definitions>>;
};
