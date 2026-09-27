import { createDatabase, orm } from '@mongorm/orm';
import { afterAll, describe, expect, expectTypeOf, it } from 'vitest';

const ownerIndexes = [
  { fields: { name: 1 as const } },
  { fields: { name: -1 as const }, options: { name: 'owner_name_desc' } },
] as const;

const ownerSchema = orm
  .schema({ name: orm.string() })
  .options({ timestamps: true, softdelete: true })
  .indexes(ownerIndexes);
const entrySchema = orm.schema({ owner: orm.objectId(), title: orm.string() });

const schemas = orm
  .defineSchemas({ owners: ownerSchema, entries: entrySchema })
  .defineRelations({ entries: { owner: { ref: 'owners', inverse: 'entries' } } })
  .defineScopes({ entries: { detail: [{ ref: 'owner', fields: ['name'] }] } });

const db = createDatabase({
  uri: 'mongodb://127.0.0.1:27017',
  database: 'mongorm-feature-metadata-tests',
  schemas,
});

describe('model feature metadata', () => {
  afterAll(async () => db.disconnect());

  it('exposes enabled options and every declared metadata collection', () => {
    expect(db.owners.features).toEqual({
      timestamps: true,
      softdelete: true,
      relations: [],
      scopes: [],
      virtuals: ['entries'],
      indexes: ownerIndexes,
    });

    expect(db.entries.features).toEqual({
      timestamps: false,
      softdelete: false,
      relations: ['owner'],
      scopes: ['detail'],
      virtuals: [],
      indexes: [],
    });
  });

  it('exposes feature metadata as frozen objects and arrays', () => {
    const { features } = db.owners;

    expect(Object.isFrozen(features)).toBe(true);
    expect(Object.isFrozen(features.relations)).toBe(true);
    expect(Object.isFrozen(features.scopes)).toBe(true);
    expect(Object.isFrozen(features.virtuals)).toBe(true);
    expect(Object.isFrozen(features.indexes)).toBe(true);
  });

  it('preserves literal feature types from the schema registry', () => {
    expectTypeOf(db.owners.features.timestamps).toEqualTypeOf<true>();
    expectTypeOf(db.owners.features.softdelete).toEqualTypeOf<true>();
    expectTypeOf(db.owners.features.relations).toEqualTypeOf<readonly never[]>();
    expectTypeOf(db.owners.features.scopes).toEqualTypeOf<readonly never[]>();
    expectTypeOf(db.owners.features.virtuals).toEqualTypeOf<readonly 'entries'[]>();
    expectTypeOf(db.owners.features.indexes).toEqualTypeOf<
      readonly (typeof ownerIndexes)[number][]
    >();

    expectTypeOf(db.entries.features.timestamps).toEqualTypeOf<false>();
    expectTypeOf(db.entries.features.softdelete).toEqualTypeOf<false>();
    expectTypeOf(db.entries.features.relations).toEqualTypeOf<readonly 'owner'[]>();
    expectTypeOf(db.entries.features.scopes).toEqualTypeOf<readonly 'detail'[]>();
    expectTypeOf(db.entries.features.virtuals).toEqualTypeOf<readonly never[]>();
    expectTypeOf(db.entries.features.indexes).toEqualTypeOf<readonly never[]>();
  });
});
