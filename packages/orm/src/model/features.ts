import type { SchemaRelationMap } from '../relations/definitions.js';
import type { ScopeDefinitions } from '../schema/contracts.js';
import type { SchemaIndex } from '../schema/indexes.js';
import { hasSoftDelete, type SoftDeleteEnabled } from '../schema/options.js';
import type { SchemaOptions } from '../schema/options.js';
import type { Schema } from '../schema/schema.js';

/** Runtime capability metadata derived from a model's registered schema. */
export type ModelFeaturesOf<SchemaType> = SchemaType extends {
  readonly __relations: infer Relations extends SchemaRelationMap;
  readonly __scopes: infer Scopes extends ScopeDefinitions;
  readonly __options: infer Options extends SchemaOptions;
  readonly __indexes: infer Indexes extends readonly SchemaIndex<any>[];
  readonly __virtuals: infer Virtuals;
}
  ? {
      readonly timestamps: Options['timestamps'] extends true ? true : false;
      readonly softdelete: SoftDeleteEnabled<Options>;
      readonly relations: readonly Extract<keyof Relations, string>[];
      readonly scopes: readonly Extract<keyof Scopes, string>[];
      readonly virtuals: readonly Extract<keyof Virtuals, string>[];
      readonly indexes: readonly Indexes[number][];
      readonly searchables: readonly string[];
    }
  : never;

/** Build immutable feature metadata from a schema's registered declarations. */
export const createModelFeatures = <SchemaType extends Schema<any, any, any, any, any, any>>(
  schema: SchemaType,
): ModelFeaturesOf<SchemaType> =>
  Object.freeze({
    timestamps: schema.optionsConfig.timestamps === true,
    softdelete: hasSoftDelete(schema.optionsConfig),
    relations: Object.freeze(Object.keys(schema.relationMap)),
    scopes: Object.freeze(Object.keys(schema.scopeMap)),
    virtuals: Object.freeze(Object.keys(schema.virtualMap)),
    indexes: Object.freeze([...schema.indexDefinitions]),
    searchables: Object.freeze([...schema.searchableFields]),
  }) as ModelFeaturesOf<SchemaType>;
