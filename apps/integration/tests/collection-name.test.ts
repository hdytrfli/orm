import { createDatabase, orm } from '@mongorm/orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { env } from '@/libs/env';

const companySchema = orm
  .schema({ name: orm.string() })
  .options({ collection: 'physical_search_companies' })
  .indexes([{ fields: { name: 1 } }]);
const personSchema = orm
  .schema({ name: orm.string(), company: orm.objectId() })
  .options({ collection: 'physical_search_people' });
const schemas = orm
  .defineSchemas({ people: personSchema, companies: companySchema })
  .defineRelations({ people: { company: { ref: 'companies' } } })
  .defineSearches({ people: ['name', 'company.name'] });
const db = createDatabase({
  uri: env.MONGODB_URI,
  database: 'mongorm-collection-name-tests',
  schemas,
});

describe('custom MongoDB collection names', () => {
  beforeAll(async () => db.connect());
  afterEach(async () => db.unsafe.purge({ quiet: true }));
  afterAll(async () => db.disconnect());

  it('uses custom names for model queries, relation lookups, population, and index sync', async () => {
    const company = await db.companies.create({ name: 'Acme Labs' });
    await db.people.create({ name: 'Ada', company: company._id });

    const matched = await db.people
      .find()
      .search('acme')
      .populate([{ ref: 'company' }])
      .first();
    expect(matched?.name).toBe('Ada');
    expect(matched?.company?.name).toBe('Acme Labs');
    expect(await db.native.collection('physical_search_people').countDocuments()).toBe(1);
    expect(await db.native.listCollections({ name: 'people' }).hasNext()).toBe(false);

    const synchronized = await db.sync();
    expect(synchronized.physical_search_companies).toHaveLength(1);
  });
});
