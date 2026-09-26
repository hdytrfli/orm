import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { Schema } from '../src/schema/schema.js';

describe('schema runtime parsing', () => {
  it('reuses partial parsing behavior for successive update payloads', () => {
    const schema = new Schema({ name: z.string(), age: z.number() });

    expect(schema.parsePartial({ name: 'Ada' })).toEqual({ name: 'Ada' });
    expect(schema.parsePartial({ age: 37 })).toEqual({ age: 37 });
    expect(() => schema.parsePartial({ age: '37' })).toThrow('Invalid input');
  });
});
