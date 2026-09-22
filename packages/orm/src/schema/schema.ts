import { z } from 'zod';

import type { SchemaDefinition, SchemaShape } from './contracts.js';
import type { Infer, InferShape } from './inference.js';
import { collectRefs } from './relations.js';
import type {
  RelationInput,
  RelationInputTarget,
  RelationMap,
  SchemaRelation,
  SchemaRelationMap,
  SchemaLike,
} from './relations.js';

/** A typed, runtime-validated schema definition. */
export class Schema<Shape extends SchemaShape, Relations extends SchemaRelationMap = {}> {
  /** The underlying Zod object for advanced validation use cases. */
  readonly definition: SchemaDefinition<Shape>;

  /** The lazily resolved relation metadata declared by this schema. */
  readonly refs: RelationMap<Shape>;

  /** One-way relation metadata declared for this schema. */
  readonly relationMap: Relations;

  /** Field names excluded from default query results. */
  readonly hiddenFields: readonly (keyof Shape & string)[];

  /** Field names declared by this schema. */
  readonly fields: readonly (keyof Shape & string)[];

  /** Construct a schema from a Zod object shape. */
  constructor(shape: Shape, relations = {} as Relations) {
    this.definition = z.object(shape);
    this.refs = collectRefs(shape);
    this.relationMap = relations;
    this.fields = Object.keys(shape) as (keyof Shape & string)[];
    this.hiddenFields = this.fields.filter((field) => '__hidden' in shape[field]);
  }

  /** Add one or more one-way relations without requiring circular schema declarations. */
  relations<
    const Definitions extends Partial<
      Record<Extract<keyof InferShape<this>, string>, RelationInput>
    >,
  >(
    definitions: Definitions,
  ): Schema<
    Shape,
    Relations & {
      [Name in keyof Definitions]: SchemaRelation<
        RelationInputTarget<NonNullable<Definitions[Name]>>,
        Extract<Name, string>,
        NonNullable<Definitions[Name]> extends { foreignField: infer Foreign extends string }
          ? Foreign
          : '_id'
      >;
    }
  > {
    for (const [name, input] of Object.entries(definitions)) {
      const definition = (typeof input === 'function' ? { target: input } : input) as {
        target: () => SchemaLike;
        foreignField?: string;
      };
      (this.relationMap as SchemaRelationMap)[name] = {
        resolve: definition.target,
        localField: name,
        foreignField: definition.foreignField ?? '_id',
      };
    }
    return this as unknown as Schema<
      Shape,
      Relations & {
        [Name in keyof Definitions]: SchemaRelation<
          RelationInputTarget<NonNullable<Definitions[Name]>>,
          Extract<Name, string>,
          NonNullable<Definitions[Name]> extends { foreignField: infer Foreign extends string }
            ? Foreign
            : '_id'
        >;
      }
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
