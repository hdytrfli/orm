import { describe, expect, it } from 'vitest';

import { orm } from '../src/api.js';

describe('schema registry virtual bindings', () => {
  it('rejects declared virtuals omitted from defineVirtuals()', () => {
    const registry = orm
      .defineSchemas({
        owners: orm.schema({ entries: orm.virtual('many') }),
        entries: orm.schema({ owner: orm.objectId() }),
      })
      .defineRelations({ entries: { owner: { ref: 'owners' } } });

    expect(() => registry.defineVirtuals({} as never)).toThrow(
      'Virtual "owners.entries" must be bound in defineVirtuals().',
    );
  });
});
