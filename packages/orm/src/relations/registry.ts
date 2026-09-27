import { ObjectId } from 'mongodb';

import { SchemaConfigurationError } from '../validation/errors.js';
import type { SchemaRelationMap, SchemaLike } from './definitions.js';
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

      for (const [field, input] of Object.entries(relations ?? {}) as [
        string,
        { ref: string; inverse?: string },
      ][]) {
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
          inverse: input.inverse,
        };
        if (input.inverse) {
          if (target.virtualMap[input.inverse]) {
            throw new SchemaConfigurationError(
              `Duplicate inverse relation "${input.inverse}" on schema "${input.ref}".`,
            );
          }
          target.virtualMap[input.inverse] = {
            resolve: () => source,
            local: '_id',
            foreign: field,
          };
        }
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
    defineScopes: { configurable: true, enumerable: false, value: defineScopes },
  });
  return registry as SchemaRegistryBuilder<Registry>;
};

/** Create a registry of named schemas with typed relation and scope builders. */
export const createSchemaRegistry = <const Registry extends Record<string, SchemaLike>>(
  registry: Registry,
): SchemaRegistryBuilder<Registry> => attachMethods(registry);
