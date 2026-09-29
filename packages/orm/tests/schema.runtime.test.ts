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
  });

  it('reuses partial parsing behavior for successive update payloads', () => {
    const schema = new Schema({ name: z.string(), age: z.number() });

    expect(schema.parsePartial({ name: 'Ada' })).toEqual({ name: 'Ada' });
    expect(schema.parsePartial({ age: 37 })).toEqual({ age: 37 });
    expect(() => schema.parsePartial({ age: '37' })).toThrow('Invalid input');
  });
});
