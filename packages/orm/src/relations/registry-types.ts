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

type InvalidRelationFields<Registry extends Record<string, SchemaLike>, Definitions> = {
  [Source in keyof Definitions]: Source extends keyof Registry
    ? `${Extract<Source, string>}.${Exclude<
        Extract<keyof NonNullable<Definitions[Source]>, string>,
        Extract<ObjectIdPathsOfSchema<Registry[Source]>, string>
      > &
        string}`
    : `${Extract<Source, string>}.${Extract<keyof NonNullable<Definitions[Source]>, string>}`;
}[keyof Definitions];

type ValidRelationFields<Registry extends Record<string, SchemaLike>, Definitions> = [
  InvalidRelationFields<Registry, Definitions>,
] extends [never]
  ? unknown
  : {
      readonly [
        Message in `Invalid relation path "${InvalidRelationFields<Registry, Definitions>}". Use an ObjectId field declared on that source schema.`
      ]: never;
    };

type InverseEntry<Definitions> = {
  [Source in keyof Definitions]: NonNullable<Definitions[Source]> extends infer Relations
    ? Relations extends object
      ? {
          [Field in keyof Relations]: Relations[Field] extends {
            ref: infer Target extends string;
            inverse: infer Inverse extends string;
          }
            ? readonly [Source, Field, Target, Inverse]
            : never;
        }[keyof Relations]
      : never
    : never;
}[keyof Definitions];

type InversePaths<Definitions, Target extends string, Name extends string> = {
  [Source in keyof Definitions]: NonNullable<Definitions[Source]> extends infer Relations
    ? Relations extends object
      ? {
          [Field in keyof Relations]: Relations[Field] extends {
            ref: Target;
            inverse: Name;
          }
            ? `${Extract<Source, string>}.${Extract<Field, string>}`
            : never;
        }[keyof Relations]
      : never
    : never;
}[keyof Definitions];

type IsUnion<Value, Whole = Value> = Value extends Whole
  ? [Whole] extends [Value]
    ? false
    : true
  : never;

type DuplicateInverseName<Entry, Definitions> = Entry extends readonly [
  unknown,
  unknown,
  infer Target extends string,
  infer Name extends string,
]
  ? IsUnion<InversePaths<Definitions, Target, Name>> extends true
    ? `${Target & string}.${Name}`
    : never
  : never;

type DuplicateInverseNames<Definitions> = DuplicateInverseName<
  InverseEntry<Definitions>,
  Definitions
>;

type ExistingInverseConflict<
  Entry,
  Registry extends Record<string, SchemaLike>,
> = Entry extends readonly [
  unknown,
  unknown,
  infer Target extends keyof Registry,
  infer Name extends string,
]
  ? Name extends keyof SchemaVirtualsOf<Registry[Target]>
    ? `${Extract<Target, string>}.${Name}`
    : never
  : never;

type ExistingInverseConflicts<
  Registry extends Record<string, SchemaLike>,
  Definitions,
> = ExistingInverseConflict<InverseEntry<Definitions>, Registry>;

type UniqueInverseNames<Registry extends Record<string, SchemaLike>, Definitions> = [
  DuplicateInverseNames<Definitions> | ExistingInverseConflicts<Registry, Definitions>,
] extends [never]
  ? unknown
  : {
      readonly [
        Message in `Duplicate inverse name "${DuplicateInverseNames<Definitions> | ExistingInverseConflicts<Registry, Definitions>}". Use a unique inverse name for each relation targeting the same schema.`
      ]: never;
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
    definitions: Definitions &
      ValidRelationFields<Registry, Definitions> &
      UniqueInverseNames<Registry, Definitions>,
  ): SchemaRegistryBuilder<RegistryWithRelations<Registry, Definitions>>;
  defineScopes<const Definitions extends ScopeDefinitionsBySchema<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithScopes<Registry, Definitions>>;
};
