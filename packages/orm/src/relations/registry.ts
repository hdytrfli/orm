import { ObjectId } from 'mongodb';

import { SchemaConfigurationError } from '../validation/errors.js';
import type { SchemaRelationMap, SchemaLike, SchemaVirtualMap } from './definitions.js';
import type {
  RelationDefinitions,
  SchemaRegistryBuilder,
  ScopeDefinitionsBySchema,
} from './registry-types.js';

export type {
  RelationDefinitions,
  SchemaRegistryBuilder,
  ScopeDefinitionsBySchema,
} from './registry-types.js';

type RuntimeFieldSchema = {
  readonly _def?: {
    readonly type?: string;
    readonly options?: readonly RuntimeFieldSchema[];
    readonly values?: readonly unknown[];
  };
  readonly shape?: Record<string, RuntimeFieldSchema>;
  readonly unwrap?: () => RuntimeFieldSchema;
  readonly safeParse?: (value: unknown) => { success: boolean; data?: unknown };
};

const fieldSchemaAtPath = (schema: SchemaLike, path: string): RuntimeFieldSchema | undefined => {
  let current: RuntimeFieldSchema | undefined = schema.definition as RuntimeFieldSchema;

  for (const segment of path.split('.')) {
    while (current?.unwrap) current = current.unwrap();
    current = current?.shape?.[segment];
    if (!current) return undefined;
  }

  return current;
};

const isObjectIdField = (schema: SchemaLike, path: string): boolean =>
  fieldSchemaAtPath(schema, path)?.safeParse?.(new ObjectId()).success ?? false;

const isScalarFieldSchema = (field: RuntimeFieldSchema): boolean => {
  let current = field;
  while (current.unwrap) current = current.unwrap();

  const type = current._def?.type;
  if (
    type === 'string' ||
    type === 'number' ||
    type === 'boolean' ||
    type === 'date' ||
    type === 'enum' ||
    type === 'literal' ||
    type === 'bigint'
  ) {
    return true;
  }

  if (type === 'union') {
    return current._def?.options?.every(isScalarFieldSchema) ?? false;
  }

  if (type === 'custom') {
    const probes: unknown[] = ['', 0, false, 0n, new Date(), new ObjectId()];
    return probes.some((probe) => {
      const parsed = current.safeParse?.(probe);
      if (!parsed?.success) return false;
      return (
        parsed.data === null ||
        typeof parsed.data === 'string' ||
        typeof parsed.data === 'number' ||
        typeof parsed.data === 'boolean' ||
        typeof parsed.data === 'bigint' ||
        parsed.data instanceof Date ||
        parsed.data instanceof ObjectId
      );
    });
  }

  return false;
};

const isSearchableString = (field: RuntimeFieldSchema): boolean => {
  let current = field;
  while (current.unwrap) current = current.unwrap();
  if (current._def?.type === 'string') return true;
  if (current._def?.type === 'enum') return true;
  if (current._def?.type === 'literal')
    return (
      (current._def.values?.length ?? 0) > 0 &&
      current._def.values?.every((value) => typeof value === 'string') === true
    );
  if (current._def?.type === 'union')
    return current._def.options?.every(isSearchableString) ?? false;
  return false;
};

/** Attach relation/scope builder methods and apply definitions to schema metadata. */
const attachMethods = <Registry extends Record<string, SchemaLike>, Relations = {}>(
  registry: Registry,
  relationDefinitions: Relations = {} as Relations,
): SchemaRegistryBuilder<Registry, Relations> => {
  const defineRelations = (definitions: RelationDefinitions<Registry>) => {
    for (const [name, relations] of Object.entries(definitions)) {
      const source = registry[name];
      if (!source) {
        throw new SchemaConfigurationError(
          `Unknown schema "${name}" in relation definitions. Add it to defineSchemas() first.`,
        );
      }

      for (const [field, input] of Object.entries(relations ?? {}) as [string, { ref: string }][]) {
        const extraProperties = Object.keys(input).filter((key) => key !== 'ref');
        if (extraProperties.length > 0) {
          throw new SchemaConfigurationError(
            `Relation "${name}.${field}" only accepts the "ref" property; remove: ${extraProperties.join(', ')}.`,
          );
        }

        const target = registry[input.ref];
        if (!target) {
          throw new SchemaConfigurationError(
            `Unknown relation target "${input.ref}". Use a schema name registered with defineSchemas().`,
          );
        }
        if (!fieldSchemaAtPath(source, field)) {
          throw new SchemaConfigurationError(
            `Unknown relation field "${name}.${field}". Declare the local field in the schema first.`,
          );
        }
        if (!isObjectIdField(source, field)) {
          throw new SchemaConfigurationError(
            `Relation field "${name}.${field}" must be an ObjectId field.`,
          );
        }

        (source.relationMap as SchemaRelationMap)[field] = {
          resolve: () => target,
          localField: field,
          foreignField: '_id',
        };
      }
    }
    return attachMethods(registry, definitions);
  };

  const defineVirtuals = (definitions: Record<string, Record<string, object>>) => {
    for (const [ownerName, owner] of Object.entries(registry)) {
      const bindings = definitions[ownerName];
      for (const name of Object.keys(owner.virtualDefinitions)) {
        if (!Object.hasOwn(bindings ?? {}, name)) {
          throw new SchemaConfigurationError(
            `Virtual "${ownerName}.${name}" must be bound in defineVirtuals().`,
          );
        }
      }
    }

    for (const [ownerName, virtuals] of Object.entries(definitions)) {
      const owner = registry[ownerName];
      if (!owner) {
        throw new SchemaConfigurationError(
          `Unknown schema "${ownerName}" in virtual definitions. Add it to defineSchemas() first.`,
        );
      }

      for (const [name, placeholder] of Object.entries(owner.virtualDefinitions)) {
        if (owner.virtualMap[name]) {
          throw new SchemaConfigurationError(
            `Virtual "${ownerName}.${name}" has already been bound.`,
          );
        }
        const input = virtuals[name] as { ref?: string; via?: string; field?: string };
        const target = input.ref ? registry[input.ref] : undefined;
        if (!target || !input.via) {
          throw new SchemaConfigurationError(
            `Virtual "${ownerName}.${name}" must specify a registered ref and relation via.`,
          );
        }
        const relation = target.relationMap[input.via];
        if (!relation || relation.resolve() !== owner) {
          throw new SchemaConfigurationError(
            `Virtual "${ownerName}.${name}" via "${input.ref}.${input.via}" must be a relation targeting "${ownerName}".`,
          );
        }
        const kind = placeholder.kind;
        const needsNumericField =
          kind === 'sum' || kind === 'avg' || kind === 'min' || kind === 'max' || kind === 'median';
        const needsScalarField = kind === 'count' || kind === 'distinct';
        if (
          needsNumericField &&
          (!input.field || !fieldSchemaAtPath(target, input.field)?.safeParse?.(1).success)
        ) {
          throw new SchemaConfigurationError(
            `Virtual "${ownerName}.${name}" of kind "${kind}" requires a numeric field on "${input.ref}".`,
          );
        }
        const scalarField = input.field ? fieldSchemaAtPath(target, input.field) : undefined;
        if (needsScalarField && (!scalarField || !isScalarFieldSchema(scalarField))) {
          throw new SchemaConfigurationError(
            `Virtual "${ownerName}.${name}" of kind "${kind}" requires a scalar field on "${input.ref}".`,
          );
        }
        if (!needsNumericField && !needsScalarField && input.field !== undefined) {
          throw new SchemaConfigurationError(
            `Virtual "${ownerName}.${name}" of kind "${kind}" does not accept a field.`,
          );
        }
        (owner.virtualMap as SchemaVirtualMap)[name] = {
          kind,
          ref: input.ref,
          via: input.via,
          ...(input.field ? { field: input.field } : {}),
        } as never;
      }
      for (const name of Object.keys(virtuals ?? {})) {
        if (!Object.hasOwn(owner.virtualDefinitions, name)) {
          throw new SchemaConfigurationError(
            `Virtual "${ownerName}.${name}" must be declared with orm.virtual() in the schema shape.`,
          );
        }
      }
    }
    return attachMethods(registry, relationDefinitions);
  };

  const defineScopes = (definitions: ScopeDefinitionsBySchema<Registry>) => {
    for (const [name, scopes] of Object.entries(definitions)) {
      const schema = registry[name];
      if (!schema) {
        throw new SchemaConfigurationError(
          `Unknown schema "${name}" in scope definitions. Add it to defineSchemas() first.`,
        );
      }
      Object.assign(schema.scopeMap, scopes);
    }
    return attachMethods(registry);
  };

  const defineSearches = (definitions: Partial<Record<string, readonly string[]>>) => {
    for (const [name, paths] of Object.entries(definitions)) {
      const source = registry[name];
      if (!source)
        throw new SchemaConfigurationError(`Unknown schema "${name}" in search definitions.`);
      const uniquePaths = [...new Set(paths ?? [])];
      for (const path of uniquePaths) {
        const relationPath = Object.keys(source.relationMap)
          .sort((a, b) => b.length - a.length)
          .find((key) => path.startsWith(`${key}.`));
        const target = relationPath
          ? (source.relationMap as SchemaRelationMap)[relationPath].resolve()
          : source;
        const field = fieldSchemaAtPath(
          target,
          relationPath ? path.slice(relationPath.length + 1) : path,
        );
        if (!field || !isSearchableString(field)) {
          throw new SchemaConfigurationError(
            `Search path "${name}.${path}" must resolve to a string field.`,
          );
        }
      }
      source.searchableFields = Object.freeze(uniquePaths);
    }
    return attachMethods(registry, relationDefinitions);
  };

  Object.defineProperties(registry, {
    __registry: { configurable: false, enumerable: false, value: registry },
    defineRelations: { configurable: true, enumerable: false, value: defineRelations },
    defineVirtuals: { configurable: true, enumerable: false, value: defineVirtuals },
    defineScopes: { configurable: true, enumerable: false, value: defineScopes },
    defineSearches: { configurable: true, enumerable: false, value: defineSearches },
  });
  return registry as SchemaRegistryBuilder<Registry>;
};

/** Create a registry of named schemas with typed relation and scope builders. */
export const createSchemaRegistry = <const Registry extends Record<string, SchemaLike>>(
  registry: Registry,
): SchemaRegistryBuilder<Registry> => attachMethods(registry);
