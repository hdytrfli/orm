import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { orm } from '../src/api.js';
import { Schema } from '../src/schema/schema.js';

describe('schema runtime parsing', () => {
  it('uses opt-in coercing field constructors for transport strings and typed values', () => {
    const schema = orm.schema({
      age: orm.coerce.number().int(),
      active: orm.coerce.stringbool(),
      profile: orm.object({ height: orm.coerce.number() }),
      scores: orm.array(orm.coerce.number()),
      id: orm.coerce.objectId(),
    });

    expect(
      schema.definition.parse({
        age: '42',
        active: 'false',
        profile: { height: '1.75' },
        scores: ['3', '7'],
        id: new ObjectId().toHexString(),
      }),
    ).toEqual({
      age: 42,
      active: false,
      profile: { height: 1.75 },
      scores: [3, 7],
      id: expect.any(ObjectId),
    });
    expect(() =>
      schema.definition.parse({
        age: '5',
        active: 'false',
        profile: { height: '1' },
        scores: ['1'],
        id: 'not-an-object-id',
      }),
    ).toThrow('Invalid input');

    expect(schema.definition.partial().parse({ age: '27' })).toEqual({ age: 27 });
    expect(schema.definition.pick({ age: true }).parse({ age: '31' })).toEqual({ age: 31 });
    expect(
      schema.definition.extend({ label: orm.string() }).parse({
        age: '33',
        active: 'true',
        profile: { height: '2' },
        scores: ['1'],
        id: new ObjectId(),
        label: 'test',
      }),
    ).toMatchObject({ age: 33, label: 'test' });

    expect(
      schema.definition.parse({
        age: 42,
        active: 'false',
        profile: { height: 1.75 },
        scores: [3, 7],
        id: new ObjectId(),
      }),
    ).toMatchObject({ age: 42, active: false });
  });

  it('reuses partial parsing behavior for successive update payloads', () => {
    const schema = new Schema({ name: z.string(), age: z.number() });

    expect(schema.parsePartial({ name: 'Ada' })).toEqual({ name: 'Ada' });
    expect(schema.parsePartial({ age: 37 })).toEqual({ age: 37 });
    expect(() => schema.parsePartial({ age: '37' })).toThrow('Invalid input');
  });
});
