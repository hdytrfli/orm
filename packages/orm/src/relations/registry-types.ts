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
import type { SchemaLike, SchemaRelation, SchemaVirtual } from './definitions.js';

type ObjectIdPathKeys<Value, Prefix extends string = ''> = Value extends object
  ? {
      [Key in Extract<keyof Value, string>]-?: NonNullable<Value[Key]> extends ObjectId
        ? `${Prefix}${Key}`
        : NonNullable<Value[Key]> extends ObjectId | Date | readonly unknown[]
          ? never
          : NonNullable<Value[Key]> extends object
            ? ObjectIdPathKeys<NonNullable<Value[Key]>, `${Prefix}${Key}.`>
            : never;
    }[Extract<keyof Value, string>]
  : never;

type ObjectIdPathsOfSchema<Value> = ObjectIdPathKeys<InferShape<Value>>;
type RelationInput<Registry extends Record<string, SchemaLike>> = {
  [Target in Extract<keyof Registry, string>]: { readonly ref: Target; readonly inverse?: string };
}[Extract<keyof Registry, string>];

type ValidateRelationDefinitions<Definitions> = {
  [Source in keyof Definitions]: Definitions[Source] extends object
    ? {
        [Field in keyof Definitions[Source]]: Definitions[Source][Field] extends {
          ref: string;
          inverse?: string;
        }
          ? Definitions[Source][Field]
          : never;
      }
    : never;
};

export type RelationDefinitions<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Partial<
    Record<Extract<ObjectIdPathsOfSchema<Registry[Name]>, string>, RelationInput<Registry>>
  >;
};

type RelationsFor<Registry extends Record<string, SchemaLike>, AllDefinitions, Config> = {
  [Field in keyof Config & string]: Config[Field] extends {
    ref: infer Target extends keyof Registry;
  }
    ? SchemaRelation<
        Registry[Target],
        Field,
        '_id',
        RelationsFor<
          Registry,
          AllDefinitions,
          NonNullable<AllDefinitions[Target & keyof AllDefinitions]>
        >
      >
    : never;
};

type InverseVirtuals<
  Registry extends Record<string, SchemaLike>,
  Definitions,
  Source extends keyof Registry,
> = {
  [Owner in keyof Definitions]: Definitions[Owner] extends object
    ? {
        [
          Field in keyof Definitions[Owner] as Definitions[Owner][Field] extends {
            ref: Source;
            inverse: infer Inverse extends string;
          }
            ? Inverse
            : never
        ]: Definitions[Owner][Field] extends { ref: Source }
          ? SchemaVirtual<Registry[Extract<Owner, keyof Registry>], '_id', Extract<Field, string>>
          : never;
      }
    : {};
}[keyof Definitions] extends infer Maps
  ? UnionToIntersection<Maps>
  : {};

type UnionToIntersection<Union> = (Union extends unknown ? (value: Union) => void : never) extends (
  value: infer Intersection,
) => void
  ? Intersection
  : {};

type RegistryWithRelations<
  Registry extends Record<string, SchemaLike>,
  Definitions extends RelationDefinitions<Registry>,
> = {
  [Name in keyof Registry]: WithSchemaVirtuals<
    WithSchemaRelations<
      Registry[Name],
      RelationsFor<Registry, Definitions, NonNullable<Definitions[Name]>>
    >,
    InverseVirtuals<Registry, Definitions, Name>
  >;
};

type RelationMapOf<Value> =
  Value extends Schema<any, infer Relations, any, any> ? Relations : SchemaRelationsOf<Value>;

export type ScopeDefinitionsBySchema<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Record<
    string,
    PopulateSpecs<RelationMapOf<Registry[Name]>, SchemaVirtualsOf<Registry[Name]>>
  >;
};

type RegistryWithScopes<
  Registry extends Record<string, SchemaLike>,
  Definitions extends ScopeDefinitionsBySchema<Registry>,
> = {
  [Name in keyof Registry]: WithSchemaScopes<
    Registry[Name],
    Definitions[Name] extends ScopeDefinitions ? Definitions[Name] : {}
  >;
};

export type SchemaRegistryBuilder<Registry extends Record<string, SchemaLike>> = Registry & {
  readonly __registry?: Registry;
  defineRelations<const Definitions extends RelationDefinitions<Registry>>(
    definitions: Definitions,
    ..._validation: [Definitions] extends [ValidateRelationDefinitions<Definitions>] ? [] : [never]
  ): SchemaRegistryBuilder<RegistryWithRelations<Registry, Definitions>>;
  defineScopes<const Definitions extends ScopeDefinitionsBySchema<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithScopes<Registry, Definitions>>;
};
