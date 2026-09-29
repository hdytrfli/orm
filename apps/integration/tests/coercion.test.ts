import { createDatabase, ObjectId, orm } from '@mongorm/orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { env } from '@/libs/env';

const organizationSchema = orm.schema({
  name: orm.string(),
});
const memberSchema = orm.schema({
  organization: orm.coerce.objectId(),
  age: orm.coerce.number().int().min(0),
  enabled: orm.coerce.stringbool(),
  joinedAt: orm.coerce.date(),
  details: orm.object({
    rating: orm.coerce.number(),
    verified: orm.coerce.stringbool(),
    scores: orm.array(orm.coerce.number()),
  }),
});
const schemas = orm
  .defineSchemas({
    organizations: organizationSchema,
    members: memberSchema,
  })
  .defineRelations({
    members: {
      organization: {
        ref: 'organizations',
      },
    },
  });
const db = createDatabase({
  uri: env.MONGODB_URI,
  database: 'mongorm-coercion-integration-tests',
  schemas,
});

describe('coercing field integration', () => {
  beforeAll(async () => db.connect());
  afterEach(async () =>
    db.unsafe.purge({
      quiet: true,
    }),
  );
  afterAll(async () => db.disconnect());

  it('coerces HTTP-style strings in nested fields and arrays before persisting', async () => {
    const organization = await db.organizations.create({
      name: 'Coercion Labs',
    });
    const member = await db.members.create({
      organization: organization._id.toHexString(),
      age: '42',
      enabled: 'false',
      joinedAt: '2026-09-29T00:00:00.000Z',
      details: {
        rating: '4.5',
        verified: 'true',
        scores: ['3', '5'],
      },
    });

    expect(member).toMatchObject({
      organization: organization._id,
      age: 42,
      enabled: false,
      joinedAt: new Date('2026-09-29T00:00:00.000Z'),
      details: {
        rating: 4.5,
        verified: true,
        scores: [3, 5],
      },
    });

    expect(member.organization).toBeInstanceOf(ObjectId);

    const populated = await db.members
      .find({
        _id: member._id,
      })
      .populate([
        {
          ref: 'organization',
          fields: ['name'],
        },
      ])
      .first();

    expect(populated?.organization?.name).toBe('Coercion Labs');
  });

  it('uses stringbool semantics instead of JavaScript truthiness', () => {
    const enabled = memberSchema.parse({
      organization: new ObjectId(),
      age: '1',
      enabled: 'false',
      joinedAt: new Date(),
      details: {
        rating: '1',
        verified: 'no',
        scores: [],
      },
    });
    const disabled = memberSchema.parse({
      organization: new ObjectId(),
      age: '1',
      enabled: 'yes',
      joinedAt: new Date(),
      details: {
        rating: '1',
        verified: 'false',
        scores: [],
      },
    });

    expect(enabled.enabled).toBe(false);

    expect(enabled.details.verified).toBe(false);

    expect(disabled.enabled).toBe(true);
  });

  it('rejects malformed numeric, boolean, date, and ObjectId strings', () => {
    const base = {
      organization: new ObjectId().toHexString(),
      age: '20',
      enabled: 'true',
      joinedAt: '2026-09-29T00:00:00.000Z',
      details: {
        rating: '1',
        verified: 'true',
        scores: ['2'],
      },
    };

    expect(() => memberSchema.parse({ ...base, age: 'not-a-number' })).toThrow('Invalid input');

    expect(() => memberSchema.parse({ ...base, enabled: 'sometimes' })).toThrow('expected one of');

    expect(() => memberSchema.parse({ ...base, joinedAt: 'not-a-date' })).toThrow('Invalid input');

    expect(() => memberSchema.parse({ ...base, organization: '12345678901234567890123z' })).toThrow(
      'Invalid input',
    );
  });

  it('persists coerced values directly from model create input', async () => {
    const organization = await db.organizations.create({ name: 'Coercion Labs' });
    const member = await db.members.create({
      organization: organization._id.toHexString(),
      age: '42',
      enabled: 'false',
      joinedAt: '2026-09-29T00:00:00.000Z',
      details: { rating: '1', verified: 'true', scores: ['2'] },
    });

    expect(member.age).toBe(42);
    expect(member.enabled).toBe(false);
    expect(member.details.scores).toEqual([2]);
  });

  it('rejects invalid values through ordinary model writes', async () => {
    await expect(
      db.members.create({
        organization: new ObjectId().toHexString(),
        age: 'not-a-number',
        enabled: 'false',
        joinedAt: '2026-09-29T00:00:00.000Z',
        details: {
          rating: '1',
          verified: 'true',
          scores: ['2'],
        },
      } as never),
    ).rejects.toThrow('Invalid input');
  });
});
