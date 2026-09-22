import type { SchemaShape } from './contracts.js';
import { createRef } from './relations.js';
import type { RefField, SchemaLike } from './relations.js';
import { Schema } from './schema.js';

/** A lazy named reference within a schema registry. */
export type RegistryRef = <Name extends string>(name: Name) => RefField<SchemaLike>;

/** A schema factory receiving the registry's lazy reference helper. */
export type RegistrySchemaFactory = (ref: RegistryRef) => SchemaShape;

/** A group of lazily constructed, named schemas. */
export class SchemaRegistry<Definitions extends Record<string, RegistrySchemaFactory>> {
  private readonly schemas = new Map<string, Schema<SchemaShape>>();

  constructor(private readonly definitions: Definitions) {
    const ref: RegistryRef = (name) => createRef(() => this.get(name));
    for (const [name, factory] of Object.entries(definitions)) {
      this.schemas.set(name, new Schema(factory(ref)));
    }
  }

  /** Return a named schema from the registry. */
  get<Name extends keyof Definitions>(name: Name): Schema<ReturnType<Definitions[Name]>> {
    return this.schemas.get(name as string) as Schema<ReturnType<Definitions[Name]>>;
  }
}

/** Create a circular-safe named schema registry. */
export const createRegistry = <const Definitions extends Record<string, RegistrySchemaFactory>>(
  definitions: Definitions,
): SchemaRegistry<Definitions> => new SchemaRegistry(definitions);
