import { createDatabase, ObjectId, orm } from '@mongorm/orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { env } from '@/libs/env';

const organizationSchema = orm.schema({
  name: orm.string(),
});
const memberSchema = orm.schema({
  organization: orm.objectId(),
  age: orm.number().int().min(0),
  enabled: orm.boolean(),
  joinedAt: orm.date(),
  details: orm.object({
    rating: orm.number(),
    verified: orm.boolean(),
    scores: orm.array(orm.number()),
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

describe('coerced schema integration', () => {
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
    const parsed = memberSchema.coerced.parse({
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
    const member = await db.members.create(parsed);

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
    const enabled = memberSchema.coerced.parse({
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
    const disabled = memberSchema.coerced.parse({
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

    expect(() => memberSchema.coerced.parse({ ...base, age: 'not-a-number' })).toThrow(
      'Invalid input',
    );

    expect(() => memberSchema.coerced.parse({ ...base, enabled: 'sometimes' })).toThrow(
      'Invalid input',
    );

    expect(() => memberSchema.coerced.parse({ ...base, joinedAt: 'not-a-date' })).toThrow(
      'Invalid input',
    );

    expect(() =>
      memberSchema.coerced.parse({ ...base, organization: '12345678901234567890123z' }),
    ).toThrow('Invalid input');
  });

  it('keeps ordinary model writes strict unless callers parse with schema.coerced', async () => {
    await expect(
      db.members.create({
        organization: new ObjectId().toHexString(),
        age: '42',
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
