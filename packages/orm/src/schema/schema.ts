import { z } from 'zod';

import type { SchemaDefinition, SchemaShape } from './contracts.js';
import type { Infer } from './inference.js';

/** A typed, runtime-validated schema definition. */
export class Schema<Shape extends SchemaShape> {
  /** The underlying Zod object for advanced validation use cases. */
  readonly definition: SchemaDefinition<Shape>;

  /** Construct a schema from a Zod object shape. */
  constructor(shape: Shape) {
    this.definition = z.object(shape);
  }

  /** Parse unknown input and return the inferred document type. */
  parse(input: unknown): Infer<this> {
    return this.definition.parse(input) as Infer<this>;
  }

  /** Parse unknown input without throwing on validation failure. */
  safeParse(input: unknown): ReturnType<typeof this.definition.safeParse> {
    return this.definition.safeParse(input);
  }
}
