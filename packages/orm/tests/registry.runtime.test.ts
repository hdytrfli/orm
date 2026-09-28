import { describe, expect, it } from 'vitest';

import { orm } from '../src/api.js';

describe('schema registry virtual bindings', () => {
  it('rejects removed relation properties at runtime', () => {
    const registry = orm.defineSchemas({
      owners: orm.schema({
        name: orm.string(),
      }),
      entries: orm.schema({
        owner: orm.objectId(),
      }),
    });

    expect(() =>
      registry.defineRelations({
        entries: {
          owner: {
            ref: 'owners',
            inverse: 'entries',
          },
        } as never,
      }),
    ).toThrow('only accepts the "ref" property');
  });

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

  it('rejects object and array fields for count and distinct virtuals', () => {
    const registry = orm
      .defineSchemas({
        owners: orm.schema({
          count: orm.virtual('count'),
          distinct: orm.virtual('distinct'),
        }),
        entries: orm.schema({
          owner: orm.objectId(),
          metadata: orm.object({
            source: orm.string(),
          }),
          tags: orm.array(orm.string()),
        }),
      })
      .defineRelations({
        entries: {
          owner: {
            ref: 'owners',
          },
        },
      });

    expect(() =>
      registry.defineVirtuals({
        owners: {
          count: {
            ref: 'entries',
            via: 'owner',
            field: 'metadata',
          },
          distinct: {
            ref: 'entries',
            via: 'owner',
            field: 'tags',
          },
        },
      } as never),
    ).toThrow('requires a scalar field');
  });
});
