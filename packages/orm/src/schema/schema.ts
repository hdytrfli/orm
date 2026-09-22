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

  /** Field names excluded from default query results. */
  readonly hiddenFields: readonly (keyof Shape & string)[];

  /** Field names declared by this schema. */
  readonly fields: readonly (keyof Shape & string)[];

  /** Construct a schema from a Zod object shape. */
  constructor(shape: Shape) {
    this.definition = z.object(shape);
    this.refs = collectRefs(shape);
    this.fields = Object.keys(shape) as (keyof Shape & string)[];
    this.hiddenFields = this.fields.filter((field) => '__hidden' in shape[field]);
  }

  /** Parse unknown input and return the inferred document type. */
  parse(input: unknown): InferShape<this> {
    return this.definition.parse(input) as InferShape<this>;
  }

  /** Parse a partial document for update operations. */
  parsePartial(input: unknown): Partial<InferShape<this>> {
    return this.definition.partial().parse(input) as Partial<InferShape<this>>;
  }

  /** Parse unknown input without throwing on validation failure. */
  safeParse(input: unknown): ReturnType<typeof this.definition.safeParse> {
    return this.definition.safeParse(input);
  }
}
