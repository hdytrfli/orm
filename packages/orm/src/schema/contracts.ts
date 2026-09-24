import type { z } from 'zod';

/** A Zod object shape used as the source of truth for a model. */
export type SchemaShape = z.ZodRawShape;

/** The runtime Zod object generated from a schema shape. */
export type SchemaDefinition<Shape extends SchemaShape> = z.ZodObject<Shape>;

/** Population scopes keyed by scope name. */
export type ScopeDefinitions = Record<string, readonly object[]>;
