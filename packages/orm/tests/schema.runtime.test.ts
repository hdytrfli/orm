import { ObjectId } from 'mongodb';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { orm } from '../src/api.js';
import { Schema } from '../src/schema/schema.js';

describe('schema runtime parsing', () => {
  it('coerces transport strings with schema.coerced while keeping definition strict', () => {
    const schema = orm.schema({
      age: orm.number().int(),
      active: orm.boolean(),
      profile: orm.object({ height: orm.number() }),
      scores: orm.array(orm.number()),
      id: orm.objectId(),
    });

    expect(() => schema.definition.parse({ age: '42', active: 'false' })).toThrow('Invalid input');
    expect(
      schema.coerced.parse({
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
      schema.coerced.parse({
        age: '5',
        active: 'false',
        profile: { height: '1' },
        scores: ['1'],
        id: 'not-an-object-id',
      }),
    ).toThrow('Invalid input');

    expect(schema.coerced.partial().parse({ age: '27' })).toEqual({ age: 27 });
    expect(schema.coerced.pick({ age: true }).parse({ age: '31' })).toEqual({ age: 31 });
    expect(
      schema.coerced.extend({ label: orm.string() }).parse({
        age: '33',
        active: 'true',
        profile: { height: '2' },
        scores: ['1'],
        id: new ObjectId(),
        label: 'test',
      }),
    ).toMatchObject({ age: 33, label: 'test' });
  });

  it('reuses partial parsing behavior for successive update payloads', () => {
    const schema = new Schema({ name: z.string(), age: z.number() });

    expect(schema.parsePartial({ name: 'Ada' })).toEqual({ name: 'Ada' });
    expect(schema.parsePartial({ age: 37 })).toEqual({ age: 37 });
    expect(() => schema.parsePartial({ age: '37' })).toThrow('Invalid input');
  });
});
