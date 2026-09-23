import type { ObjectId } from 'mongodb';

import type { PopulateSpecs } from '../query/query.js';
import type { SchemaShape } from './contracts.js';
import type { InferShape } from './inference.js';
import type { SchemaRelation, SchemaRelationMap, SchemaLike } from './relations.js';
import type { Schema, ScopeDefinitions } from './schema.js';

type ObjectIdKeys<Shape extends SchemaShape> = {
  [Key in keyof InferShape<Schema<Shape>>]-?: NonNullable<
    InferShape<Schema<Shape>>[Key]
  > extends ObjectId
    ? Key
    : never;
}[keyof InferShape<Schema<Shape>>];

export type RelationDefinitions<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Registry[Name] extends Schema<infer Shape, any, any, any>
    ? Partial<Record<Extract<ObjectIdKeys<Shape>, string>, Extract<keyof Registry, string>>>
    : never;
};

type EnrichedSchema<
  Registry extends Record<string, SchemaLike>,
  AllDefinitions extends RelationDefinitions<Registry>,
  Name,
> = Name extends keyof Registry
  ? Registry[Name] extends Schema<infer Shape, infer Relations, infer Scopes, infer Options>
    ? Schema<
        Shape,
        Relations & RelationsFor<Registry, AllDefinitions, NonNullable<AllDefinitions[Name]>>,
        Scopes,
        Options
      >
    : never
  : never;

type RelationsFor<
  Registry extends Record<string, SchemaLike>,
  AllDefinitions extends RelationDefinitions<Registry>,
  Definitions,
> = {
  [Field in keyof Definitions & string]: Definitions[Field] extends keyof Registry
    ? SchemaRelation<EnrichedSchema<Registry, AllDefinitions, Definitions[Field]>, Field, '_id'>
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
        Options
      >
    : Registry[Name];
};

type RelationMapOf<Value> = Value extends Schema<any, infer Relations, any, any> ? Relations : {};

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
        Options
      >
    : Registry[Name];
};

export type SchemaRegistryBuilder<Registry extends Record<string, SchemaLike>> = Registry & {
  readonly __registry?: Registry;
  defineRelations<const Definitions extends RelationDefinitions<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithRelations<Registry, Definitions>>;
  defineScopes<const Definitions extends ScopeDefinitionsBySchema<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithScopes<Registry, Definitions>>;
};

const attachMethods = <Registry extends Record<string, SchemaLike>>(
  registry: Registry,
): SchemaRegistryBuilder<Registry> => {
  const defineRelations = (definitions: RelationDefinitions<Registry>) => {
    for (const [name, relations] of Object.entries(definitions)) {
      const targetSchema = registry[name];
      if (!targetSchema) throw new Error(`Unknown schema "${name}" in relation definitions`);
      for (const [field, targetName] of Object.entries(relations ?? {})) {
        const target = registry[targetName as string];
        if (!target) throw new Error(`Unknown relation target "${targetName}"`);
        if (!(field in targetSchema.definition.shape)) {
          throw new Error(`Unknown relation field "${name}.${field}"`);
        }
        (targetSchema.relationMap as SchemaRelationMap)[field] = {
          resolve: () => target,
          localField: field,
          foreignField: '_id',
        };
      }
    }
    return attachMethods(registry);
  };

  const defineScopes = (definitions: ScopeDefinitionsBySchema<Registry>) => {
    for (const [name, scopes] of Object.entries(definitions)) {
      const targetSchema = registry[name];
      if (!targetSchema) throw new Error(`Unknown schema "${name}" in scope definitions`);
      Object.assign(targetSchema.scopeMap, scopes);
    }
    return attachMethods(registry);
  };

  Object.defineProperties(registry, {
    __registry: { configurable: false, enumerable: false, value: registry },
    defineRelations: { configurable: true, enumerable: false, value: defineRelations },
    defineScopes: { configurable: true, enumerable: false, value: defineScopes },
  });
  return registry as SchemaRegistryBuilder<Registry>;
};

export const createSchemaRegistry = <const Registry extends Record<string, SchemaLike>>(
  registry: Registry,
): SchemaRegistryBuilder<Registry> => attachMethods(registry);
