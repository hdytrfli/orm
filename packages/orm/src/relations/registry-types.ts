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
import type {
  SchemaLike,
  SchemaRelation,
  VirtualPlaceholder,
  VirtualBinding,
  VirtualKind,
} from './definitions.js';

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

type ObjectIdPaths<SchemaType> = ObjectIdPathKeys<InferShape<SchemaType>>;
type NumericKeys<Value, Prefix extends string = ''> = Value extends object
  ? {
      [Key in Extract<keyof Value, string>]-?: NonNullable<Value[Key]> extends number
        ? `${Prefix}${Key}`
        : NonNullable<Value[Key]> extends ObjectId | Date | readonly unknown[]
          ? never
          : NonNullable<Value[Key]> extends object
            ? NumericKeys<NonNullable<Value[Key]>, `${Prefix}${Key}.`>
            : never;
    }[Extract<keyof Value, string>]
  : never;
type ScalarFieldPaths<Value, Prefix extends string = ''> = Value extends object
  ? {
      [Key in Extract<keyof Value, string>]-?: NonNullable<Value[Key]> extends ObjectId | Date
        ? `${Prefix}${Key}`
        : NonNullable<Value[Key]> extends readonly unknown[]
          ? never
          : NonNullable<Value[Key]> extends object
            ? ScalarFieldPaths<NonNullable<Value[Key]>, `${Prefix}${Key}.`>
            : `${Prefix}${Key}`;
    }[Extract<keyof Value, string>]
  : never;

export type RelationDefinitions<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Partial<
    Record<
      Extract<ObjectIdPaths<Registry[Name]>, string>,
      { readonly ref: keyof Registry & string }
    >
  >;
};

type InvalidRelationFields<Registry extends Record<string, SchemaLike>, Definitions> = {
  [Source in keyof Definitions]: Source extends keyof Registry
    ? Exclude<
        Extract<keyof NonNullable<Definitions[Source]>, string>,
        Extract<ObjectIdPaths<Registry[Source]>, string>
      > extends infer Invalid extends string
      ? `${Extract<Source, string>}.${Invalid}`
      : never
    : Extract<keyof NonNullable<Definitions[Source]>, string>;
}[keyof Definitions];

type InvalidRelationProperties<Definitions> = {
  [Source in keyof Definitions]: {
    [Field in keyof NonNullable<Definitions[Source]>]: Exclude<
      keyof NonNullable<Definitions[Source]>[Field],
      'ref'
    > extends never
      ? never
      : `${Extract<Source, string>}.${Extract<Field, string>}`;
  }[keyof NonNullable<Definitions[Source]>];
}[keyof Definitions];

type InvalidRelationDefinitions<Registry extends Record<string, SchemaLike>, Definitions> =
  | InvalidRelationFields<Registry, Definitions>
  | InvalidRelationProperties<Definitions>;

type ValidateRelationFields<Registry extends Record<string, SchemaLike>, Definitions> = [
  InvalidRelationDefinitions<Registry, Definitions>,
] extends [never]
  ? unknown
  : {
      readonly [
        Message in `Invalid relation definition(s): ${InvalidRelationDefinitions<Registry, Definitions>}`
      ]: never;
    };

type RelationsFor<Registry extends Record<string, SchemaLike>, AllDefinitions, Config> = [
  Config,
] extends [never]
  ? {}
  : Config extends object
    ? {
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
      }
    : {};

type RegistryWithRelations<Registry extends Record<string, SchemaLike>, Definitions> = {
  [Name in keyof Registry]: WithSchemaRelations<
    Registry[Name],
    RelationsFor<Registry, Definitions, NonNullable<Definitions[Name & keyof Definitions]>>
  >;
};

type DeclaredKind<Value> = Value extends VirtualPlaceholder<infer Kind> ? Kind : never;
type VirtualNames<SchemaType> = Extract<keyof SchemaVirtualsOf<SchemaType>, string>;
type TargetName<Config> = Config extends { ref: infer Target extends string } ? Target : never;
type ViaName<Config> = Config extends { via: infer Via extends string } ? Via : never;

type RelationBinding<Relations, Owner extends string> = {
  [Target in Extract<keyof Relations, string>]: {
    [Via in Extract<keyof NonNullable<Relations[Target]>, string>]: NonNullable<
      Relations[Target]
    >[Via] extends { ref: Owner }
      ? { readonly ref: Target; readonly via: Via }
      : never;
  }[Extract<keyof NonNullable<Relations[Target]>, string>];
}[Extract<keyof Relations, string>];

type NumericFields<
  Registry extends Record<string, SchemaLike>,
  Target extends keyof Registry,
> = Extract<NumericKeys<InferShape<Registry[Target]>>, string>;

type BindingInput<
  Registry extends Record<string, SchemaLike>,
  Relations,
  Owner extends string,
  Kind extends VirtualKind,
> =
  RelationBinding<Relations, Owner> extends infer Binding
    ? Binding extends { ref: infer Target extends keyof Registry & string }
      ? Kind extends 'sum' | 'avg' | 'min' | 'max' | 'median'
        ? Binding & { readonly field: NumericFields<Registry, Target> }
        : Kind extends 'distinct'
          ? Binding & {
              readonly field: Extract<ScalarFieldPaths<InferShape<Registry[Target]>>, string>;
            }
          : Kind extends 'count'
            ? Binding & {
                readonly field: Extract<ScalarFieldPaths<InferShape<Registry[Target]>>, string>;
              }
            : Binding
      : never
    : never;

type BindingKeys<Kind extends VirtualKind> = Kind extends
  | 'sum'
  | 'avg'
  | 'min'
  | 'max'
  | 'median'
  | 'distinct'
  | 'count'
  ? 'ref' | 'via' | 'field'
  : 'ref' | 'via';

type ValidateVirtualBindings<
  Registry extends Record<string, SchemaLike>,
  Relations,
  Definitions,
> = {
  [Owner in keyof Definitions]: Owner extends keyof Registry
    ? {
        [Name in keyof NonNullable<Definitions[Owner]>]: Name extends VirtualNames<Registry[Owner]>
          ? NonNullable<Definitions[Owner]>[Name] extends BindingInput<
              Registry,
              Relations,
              Extract<Owner, string>,
              Extract<DeclaredKind<SchemaVirtualsOf<Registry[Owner]>[Name]>, VirtualKind>
            >
            ? Exclude<
                keyof NonNullable<Definitions[Owner]>[Name],
                BindingKeys<
                  Extract<DeclaredKind<SchemaVirtualsOf<Registry[Owner]>[Name]>, VirtualKind>
                >
              > extends never
              ? unknown
              : never
            : never
          : never;
      }
    : never;
};

export type VirtualDefinitions<Registry extends Record<string, SchemaLike>, Relations> = {
  [Owner in keyof Registry]?: {
    [Name in VirtualNames<Registry[Owner]>]: BindingInput<
      Registry,
      Relations,
      Extract<Owner, string>,
      Extract<DeclaredKind<SchemaVirtualsOf<Registry[Owner]>[Name]>, VirtualKind>
    >;
  };
};

type BoundVirtual<Registry extends Record<string, SchemaLike>, Config, Kind extends VirtualKind> =
  TargetName<Config> extends infer Target extends keyof Registry & string
    ? VirtualBinding<Registry[Target], Target, ViaName<Config>, Kind> &
        (Config extends { field: infer Field extends string } ? { readonly field: Field } : {})
    : never;

type BoundVirtuals<
  Registry extends Record<string, SchemaLike>,
  Definitions,
  Owner extends keyof Registry,
> = Owner extends keyof Definitions
  ? {
      [Name in keyof NonNullable<Definitions[Owner]> & string]: BoundVirtual<
        Registry,
        NonNullable<Definitions[Owner]>[Name],
        Extract<DeclaredKind<SchemaVirtualsOf<Registry[Owner]>[Name]>, VirtualKind>
      >;
    }
  : {};

type RegistryWithVirtuals<Registry extends Record<string, SchemaLike>, Definitions> = {
  [Name in keyof Registry]: WithSchemaVirtuals<
    Registry[Name],
    BoundVirtuals<Registry, Definitions, Name>
  >;
};

export type ScopeDefinitionsBySchema<Registry extends Record<string, SchemaLike>> = {
  [Name in keyof Registry]?: Record<
    string,
    PopulateSpecs<SchemaRelationsOf<Registry[Name]>, SchemaVirtualsOf<Registry[Name]>>
  >;
};

type RegistryWithScopes<Registry, Definitions> = {
  [Name in keyof Registry]: WithSchemaScopes<
    Registry[Name],
    Definitions[Name & keyof Definitions] extends ScopeDefinitions
      ? Definitions[Name & keyof Definitions]
      : {}
  >;
};

export type SchemaRegistryBuilder<
  Registry extends Record<string, SchemaLike>,
  Relations = {},
> = Registry & {
  readonly __registry?: Registry;
  defineRelations<const Definitions extends RelationDefinitions<Registry>>(
    definitions: Definitions & ValidateRelationFields<Registry, Definitions>,
  ): SchemaRegistryBuilder<RegistryWithRelations<Registry, Definitions>, Definitions>;
  defineVirtuals<const Definitions extends VirtualDefinitions<Registry, Relations>>(
    definitions: Definitions & ValidateVirtualBindings<Registry, Relations, Definitions>,
  ): SchemaRegistryBuilder<RegistryWithVirtuals<Registry, Definitions>, Relations>;
  defineScopes<const Definitions extends ScopeDefinitionsBySchema<Registry>>(
    definitions: Definitions,
  ): SchemaRegistryBuilder<RegistryWithScopes<Registry, Definitions>, Relations>;
};
