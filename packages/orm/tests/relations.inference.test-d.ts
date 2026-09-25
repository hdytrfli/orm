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
            localField: 'profile.department',
            foreignField: 'department',
          },
        },
      });

    const database = {} as ReturnType<typeof createDatabase<typeof registry>>;
    const populatedPeople = await database.people.find().populate([
      {
        virtual: 'projects',
        select: ['title'],
      },
    ]);

    const projectTitle: string | undefined = populatedPeople[0].projects[0]?.title;
    const localFieldType =
      expectTypeOf<(typeof registry.people.virtualMap.projects)['localField']>();

    void projectTitle;
    localFieldType.toEqualTypeOf<'profile.department'>();

    const invalidVirtual = {
      ref: 'projects',
      localField: 'profile.nickname',
      foreignField: 'department',
    } as const;

    registry.defineVirtual({
      people: {
        // @ts-expect-error Virtual local fields must be ObjectId paths.
        projects: invalidVirtual,
      },
    });
  });
});
