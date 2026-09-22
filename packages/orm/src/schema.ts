import { z } from 'zod';

export type SchemaShape = z.ZodRawShape;

export class Schema<Shape extends SchemaShape> {
  readonly definition: z.ZodObject<Shape>;

  constructor(shape: Shape) {
    this.definition = z.object(shape);
  }

  parse(input: unknown): Infer<this> {
    return this.definition.parse(input) as Infer<this>;
  }

  safeParse(input: unknown): ReturnType<typeof this.definition.safeParse> {
    return this.definition.safeParse(input);
  }
}

export type Infer<T extends Schema<SchemaShape>> = z.infer<T['definition']>;

export const orm = {
  schema: <Shape extends SchemaShape>(shape: Shape) => new Schema(shape),
  string: () => z.string(),
  number: () => z.number(),
  boolean: () => z.boolean(),
  date: () => z.date(),
  enum: <const Values extends readonly [string, ...string[]]>(values: Values) => z.enum(values),
};
