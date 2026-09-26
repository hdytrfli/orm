import { ObjectId } from 'mongodb';

import { SchemaConfigurationError } from '../validation/errors.js';
import type { SchemaRelationMap, SchemaLike } from './definitions.js';
import type {
  RelationDefinitions,
  SchemaRegistryBuilder,
  ScopeDefinitionsBySchema,
  VirtualDefinitions,
} from './registry-types.js';

export type {
  RelationDefinitions,
  SchemaRegistryBuilder,
  ScopeDefinitionsBySchema,
  VirtualDefinitions,
} from './registry-types.js';

type RuntimeFieldSchema = {
  readonly shape?: Record<string, RuntimeFieldSchema>;
  readonly unwrap?: () => RuntimeFieldSchema;
  readonly safeParse?: (value: unknown) => { success: boolean };
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

/** Attach relation/scope builder methods and apply definitions to schema metadata. */
const attachMethods = <Registry extends Record<string, SchemaLike>>(
  registry: Registry,
): SchemaRegistryBuilder<Registry> => {
  const defineRelations = (definitions: RelationDefinitions<Registry>) => {
    for (const [name, relations] of Object.entries(definitions)) {
      const source = registry[name];
      if (!source) {
        throw new SchemaConfigurationError(
          `Unknown schema "${name}" in relation definitions. Add it to defineSchemas() first.`,
        );
      }

      for (const [field, targetName] of Object.entries(relations ?? {})) {
        const target = registry[targetName as string];
        if (!target) {
          throw new SchemaConfigurationError(
            `Unknown relation target "${targetName}". Use a schema name registered with defineSchemas().`,
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
    return attachMethods(registry);
  };

  const defineVirtual = (definitions: VirtualDefinitions<Registry>) => {
    for (const [name, virtuals] of Object.entries(definitions)) {
      const source = registry[name];
      if (!source) {
        throw new SchemaConfigurationError(
          `Unknown schema "${name}" in virtual definitions. Add it to defineSchemas() first.`,
        );
      }

      for (const [virtualName, input] of Object.entries(virtuals ?? {}) as [
        string,
        {
          ref: string;
          local: string;
          foreign: string;
          type: 'many' | 'first';
          aggregate?: { field: string; type: 'count' | 'sum' | 'average' | 'min' | 'max' };
          select?: readonly string[];
          show?: readonly string[];
          match?: Record<string, unknown>;
        },
      ][]) {
        const target = registry[input.ref];
        if (!target) {
          throw new SchemaConfigurationError(
            `Unknown virtual target "${input.ref}". Use a schema name registered with defineSchemas().`,
          );
        }
        if (input.local !== '_id' && !fieldSchemaAtPath(source, input.local)) {
          throw new SchemaConfigurationError(
            `Unknown local field "${name}.${input.local}" in virtual "${virtualName}".`,
          );
        }
        if (input.local !== '_id' && !isObjectIdField(source, input.local)) {
          throw new SchemaConfigurationError(
            `Virtual local field "${name}.${input.local}" must be an ObjectId field.`,
          );
        }
        if (input.foreign !== '_id' && !fieldSchemaAtPath(target, input.foreign)) {
          throw new SchemaConfigurationError(
            `Unknown foreign field "${input.ref}.${input.foreign}" in virtual "${virtualName}".`,
          );
        }
        if (input.foreign !== '_id' && !isObjectIdField(target, input.foreign)) {
          throw new SchemaConfigurationError(
            `Virtual foreign field "${input.ref}.${input.foreign}" must be an ObjectId field.`,
          );
        }

        source.virtualMap[virtualName] = {
          resolve: () => target,
          local: input.local,
          foreign: input.foreign,
          type: input.type,
          ...(input.type === 'many' && input.aggregate ? { aggregate: input.aggregate } : {}),
          select: input.select,
          show: input.show,
          ...(input.type === 'many' && input.match ? { match: input.match } : {}),
        };
      }
    }
    return attachMethods(registry);
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

  Object.defineProperties(registry, {
    __registry: { configurable: false, enumerable: false, value: registry },
    defineRelations: { configurable: true, enumerable: false, value: defineRelations },
    defineVirtual: { configurable: true, enumerable: false, value: defineVirtual },
    defineScopes: { configurable: true, enumerable: false, value: defineScopes },
  });
  return registry as SchemaRegistryBuilder<Registry>;
};

/** Create a registry of named schemas with typed relation and scope builders. */
export const createSchemaRegistry = <const Registry extends Record<string, SchemaLike>>(
  registry: Registry,
): SchemaRegistryBuilder<Registry> => attachMethods(registry);
