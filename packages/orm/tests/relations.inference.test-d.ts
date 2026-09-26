import { describe, expectTypeOf, it } from 'vitest';

import type { createDatabase } from '../src/index.js';
import { ObjectId, orm } from '../src/index.js';

describe('relation inference', () => {
  it('populates nested ObjectId relation paths with the target shape', async () => {
    const personSchema = orm.schema({
      name: orm.string(),
      profile: orm.object({
        department: orm.objectId(),
        nickname: orm.string(),
      }),
    });
    const departmentSchema = orm.schema({
      name: orm.string(),
    });
    const registry = orm
      .defineSchemas({
        people: personSchema,
        departments: departmentSchema,
      })
      .defineRelations({
        people: {
          'profile.department': 'departments',
        },
      });

    const database = {} as ReturnType<typeof createDatabase<typeof registry>>;
    const populatedPeople = await database.people.find().populate([
      {
        ref: 'profile.department',
        select: ['name'],
      },
    ]);

    const departmentName: string | undefined = populatedPeople[0].profile.department?.name;
    const departmentId: ObjectId | undefined = populatedPeople[0].profile.department?._id;
    const localFieldType =
      expectTypeOf<(typeof registry.people.relationMap)['profile.department']['localField']>();

    void departmentName;
    void departmentId;
    localFieldType.toEqualTypeOf<'profile.department'>();

    registry.defineRelations({
      people: {
        // @ts-expect-error Nested relations require ObjectId paths.
        'profile.nickname': 'departments',
      },
    });
  });

  it('types virtual joins and rejects non-ObjectId local fields', async () => {
    const people = orm.schema({
      profile: orm.object({
        department: orm.objectId(),
        nickname: orm.string(),
      }),
    });

    const departments = orm.schema({
      name: orm.string(),
    });

    const projects = orm.schema({
      department: orm.objectId(),
      title: orm.string(),
      status: orm.string(),
      score: orm.number(),
      internal: orm.string().hidden(),
    });

    const registry = orm
      .defineSchemas({
        people,
        departments,
        projects,
      })
      .defineRelations({
        people: {
          'profile.department': 'departments',
        },
      })
      .defineVirtual({
        people: {
          projects: {
            ref: 'projects',
            local: 'profile.department',
            foreign: 'department',
            type: 'many',
            select: ['title'],
          },
        },
      });

    const database = {} as ReturnType<typeof createDatabase<typeof registry>>;
    const populatedPeople = await database.people.find().populate([
      {
        virtual: 'projects',
      },
    ]);

    const projectTitle: string | undefined = populatedPeople[0]!.projects[0]?.title;
    const localFieldType = expectTypeOf<(typeof registry.people.virtualMap.projects)['local']>();

    void projectTitle;
    localFieldType.toEqualTypeOf<'profile.department'>();

    const configured = registry.defineVirtual({
      people: {
        scoreCount: {
          ref: 'projects',
          local: '_id',
          foreign: 'department',
          type: 'many',
          aggregate: { field: 'score', type: 'count' },
        },
        scoreAverage: {
          ref: 'projects',
          local: '_id',
          foreign: 'department',
          type: 'many',
          aggregate: { field: 'score', type: 'average' },
        },
        activeProjects: {
          ref: 'projects',
          local: '_id',
          foreign: 'department',
          type: 'many',
          match: { status: 'active' },
        },
        oneProject: {
          ref: 'projects',
          local: '_id',
          foreign: 'department',
          type: 'first',
          select: ['title'],
        },
      },
    });
    const configuredDb = {} as ReturnType<typeof createDatabase<typeof configured>>;
    const aggregateResult = await configuredDb.people
      .find()
      .populate([
        { virtual: 'scoreCount' },
        { virtual: 'scoreAverage' },
        { virtual: 'activeProjects' },
        { virtual: 'oneProject' },
      ]);
    const count: number = aggregateResult[0]!.scoreCount;
    const average: number | null = aggregateResult[0]!.scoreAverage;
    const firstTitle: string | undefined = aggregateResult[0]!.oneProject?.title;
    // @ts-expect-error Virtual selects omit fields not requested in the definition.
    void aggregateResult[0]!.oneProject?.status;
    void count;
    void average;
    void firstTitle;
    const activeTitle: string | undefined = aggregateResult[0]!.activeProjects[0]?.title;
    void activeTitle;

    configuredDb.people.find().populate([
      // @ts-expect-error Virtual projection belongs in the definition.
      {
        virtual: 'oneProject',
        select: ['title'],
      },
    ]);

    // @ts-expect-error `first` virtuals do not accept aggregates.
    configured.defineVirtual({
      people: {
        invalidFirstAggregate: {
          ref: 'projects',
          local: '_id',
          foreign: 'department',
          type: 'first',
          aggregate: { field: 'score', type: 'count' },
        },
      },
    });

    // @ts-expect-error `match` is only supported for many virtuals.
    configured.defineVirtual({
      people: {
        invalidFirstMatch: {
          ref: 'projects',
          local: '_id',
          foreign: 'department',
          type: 'first',
          match: { status: 'active' },
        },
      },
    });

    // @ts-expect-error Select fields are validated against the target schema.
    configured.defineVirtual({
      people: {
        invalidSelection: {
          ref: 'projects',
          local: '_id',
          foreign: 'department',
          type: 'many',
          select: ['notAProjectField'],
        },
      },
    });

    // @ts-expect-error Aggregate fields must be numeric target fields.
    configured.defineVirtual({
      people: {
        invalidAggregateField: {
          ref: 'projects',
          local: '_id',
          foreign: 'department',
          type: 'many',
          aggregate: { field: 'title', type: 'count' },
        },
      },
    });

    // @ts-expect-error Match filters are typed against the target document.
    configured.defineVirtual({
      people: {
        invalidMatch: {
          ref: 'projects',
          local: '_id',
          foreign: 'department',
          type: 'many',
          match: { unknownProjectKey: 'x' },
        },
      },
    });

    const invalidVirtual = {
      ref: 'projects',
      local: 'profile.nickname',
      foreign: 'department',
      type: 'many',
    } as const;

    // @ts-expect-error Virtual local fields must be ObjectId paths.
    registry.defineVirtual({
      people: {
        projects: invalidVirtual,
      },
    });
  });
});
