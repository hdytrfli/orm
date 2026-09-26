import type { ObjectId } from 'mongodb';

import type { PopulateSpecs } from '../query/index.js';
import type { ScopeDefinitions } from '../schema/contracts.js';
import type {
  SchemaRelationsOf,
  SchemaVirtualsOf,
  WithSchemaRelations,
  WithSchemaScopes,
  WithSchemaVirtuals,
} from '../schema/extractors.js';
import type { InferShape } from '../schema/inference.js';
import type { Schema } from '../schema/schema.js';
import type { SchemaRelation, SchemaLike, SchemaVirtual } from './definitions.js';

/** Recursively collect ObjectId fields as schema-relative dot paths. */
type ObjectIdPathKeys<Value, Prefix extends string = ''> = Value extends object
  ? {
      [Key in Extract<keyof Value, string>]-?: NonNullable<Value[Key]> extends ObjectId
        ? `${Prefix}${Key}`
        : NonNullable<Value[Key]> extends Date | readonly unknown[]
          ? never
          : NonNullable<Value[Key]> extends object
            ? ObjectIdPathKeys<NonNullable<Value[Key]>, `${Prefix}${Key}.`>
            : never;
    }[Extract<keyof Value, string>]
  : never;

type ObjectIdPathsOfSchema<Value> = ObjectIdPathKeys<InferShape<Value>>;

/** Valid local ObjectId fields and targets accepted by `defineRelations`. */
export type RelationDefinitions<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Registry[Name] extends Schema<any, any, any, any>
    ? Partial<
        Record<
          Extract<ObjectIdPathsOfSchema<Registry[Name]>, string>,
          Extract<keyof Registry, string>
        >
      >
    : never;
};

/** ObjectId paths accepted for a virtual join, including the implicit document `_id`. */
type ObjectIdDocumentPath<Value> =
  Value extends Schema<any, any, any, any>
    ? Extract<ObjectIdPathsOfSchema<Value>, string> | '_id'
    : '_id';

type VirtualTargetInput<
  Registry extends Record<string, SchemaLike>,
  Source extends keyof Registry,
> = {
  [Target in Extract<keyof Registry, string>]: {
    ref: Target;
    localField: ObjectIdDocumentPath<Registry[Source]>;
    foreignField: ObjectIdDocumentPath<Registry[Target]>;
  };
}[Extract<keyof Registry, string>];

/** Virtual relations map a local document field to a foreign target field. */
export type VirtualDefinitions<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Record<string, VirtualTargetInput<Registry, Name>>;
};

/** Convert one schema's virtual declarations into its typed virtual relation map. */
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

/** Add declared virtual relations to each affected schema while preserving its other types. */
type RegistryWithVirtuals<
  Registry extends Record<string, SchemaLike>,
  Definitions extends VirtualDefinitions<Registry>,
> = {
  [Name in keyof Registry]: WithSchemaVirtuals<
    Registry[Name],
    VirtualsFor<Registry, Definitions, Name>
  >;
};

/** Convert relation declarations into metadata, retaining nested target relations. */
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

/** Add declared relations to each affected schema while preserving its other types. */
type RegistryWithRelations<
  Registry extends Record<string, SchemaLike>,
  Definitions extends RelationDefinitions<Registry>,
> = {
  [Name in keyof Registry]: WithSchemaRelations<
    Registry[Name],
    RelationsFor<Registry, Definitions, NonNullable<Definitions[Name]>>
  >;
};

/** Resolve the nested relation map available when populating a relation target. */
type RelationMapOf<Value> =
  Value extends SchemaRelation<any, any, any, infer Relations>
    ? Relations
    : SchemaRelationsOf<Value>;

/** Scope declarations accepted for each registered model. */
export type ScopeDefinitionsBySchema<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Record<
    string,
    PopulateSpecs<RelationMapOf<Registry[Name]>, SchemaVirtualsOf<Registry[Name]>>
  >;
};

/** Add named population scopes without discarding the schema's existing metadata. */
type RegistryWithScopes<
  Registry extends Record<string, SchemaLike>,
  Definitions extends ScopeDefinitionsBySchema<Registry>,
> = {
  [Name in keyof Registry]: WithSchemaScopes<
    Registry[Name],
    Definitions[Name] extends ScopeDefinitions ? Definitions[Name] : {}
  >;
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
