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
        if (!(field in source.definition.shape)) {
          throw new SchemaConfigurationError(
            `Unknown relation field "${name}.${field}". Declare the local ObjectId field in the schema first.`,
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
