import { z } from 'zod';

import type { SchemaDefinition, SchemaShape } from './contracts.js';
import type { Infer, InferShape } from './inference.js';
import { collectRefs } from './relations.js';
import type { RelationMap, SchemaRelation, SchemaRelationMap, SchemaLike } from './relations.js';

/** A typed, runtime-validated schema definition. */
export class Schema<Shape extends SchemaShape, Relations extends SchemaRelationMap = {}> {
  /** The underlying Zod object for advanced validation use cases. */
  readonly definition: SchemaDefinition<Shape>;

  /** The lazily resolved relation metadata declared by this schema. */
  readonly refs: RelationMap<Shape>;

  /** One-way relation metadata declared for this schema. */
  readonly relations: Relations;

  /** Field names excluded from default query results. */
  readonly hiddenFields: readonly (keyof Shape & string)[];

  /** Field names declared by this schema. */
  readonly fields: readonly (keyof Shape & string)[];

  /** Construct a schema from a Zod object shape. */
  constructor(shape: Shape, relations = {} as Relations) {
    this.definition = z.object(shape);
    this.refs = collectRefs(shape);
    this.relations = relations;
    this.fields = Object.keys(shape) as (keyof Shape & string)[];
    this.hiddenFields = this.fields.filter((field) => '__hidden' in shape[field]);
  }

  /** Add a one-way relation without requiring circular schema declarations. */
  relation<
    Name extends string,
    Target extends SchemaLike,
    LocalField extends Extract<keyof InferShape<this>, string>,
    ForeignField extends Extract<keyof Infer<Target>, string>,
  >(
    name: Name,
    resolve: () => Target,
    options: { localField: LocalField; foreignField: ForeignField },
  ): Schema<Shape, Relations & Record<Name, SchemaRelation<Target, LocalField, ForeignField>>> {
    (this.relations as SchemaRelationMap)[name] = {
      resolve,
      localField: options.localField,
      foreignField: options.foreignField,
    };
    return this as unknown as Schema<
      Shape,
      Relations & Record<Name, SchemaRelation<Target, LocalField, ForeignField>>
    >;
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
