import { describe, expect, it } from 'vitest';

import { orm } from '../src/index.js';

describe('schema', () => {
  it('parses a schema definition', () => {
    const user = orm.schema({ name: orm.string(), age: orm.number() });

    expect(user.parse({ name: 'Ada', age: 36 })).toEqual({ name: 'Ada', age: 36 });
  });
});
