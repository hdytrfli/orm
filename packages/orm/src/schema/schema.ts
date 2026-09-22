import { z } from 'zod';

import type { SchemaDefinition, SchemaShape } from './contracts.js';
import type { InferShape } from './inference.js';
import { collectRefs } from './relations.js';
import type { RelationMap } from './relations.js';

/** A typed, runtime-validated schema definition. */
export class Schema<Shape extends SchemaShape> {
  /** The underlying Zod object for advanced validation use cases. */
  readonly definition: SchemaDefinition<Shape>;

  /** The lazily resolved relation metadata declared by this schema. */
  readonly refs: RelationMap<Shape>;

  /** Construct a schema from a Zod object shape. */
  constructor(shape: Shape) {
    this.definition = z.object(shape);
    this.refs = collectRefs(shape);
  }

  /** Parse unknown input and return the inferred document type. */
  parse(input: unknown): InferShape<this> {
    return this.definition.parse(input) as InferShape<this>;
  }

  /** Parse unknown input without throwing on validation failure. */
  safeParse(input: unknown): ReturnType<typeof this.definition.safeParse> {
    return this.definition.safeParse(input);
  }
}
