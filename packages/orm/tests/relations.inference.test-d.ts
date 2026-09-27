import { describe, expectTypeOf, it } from 'vitest';

import type { createDatabase } from '../src/index.js';
import { ObjectId, orm } from '../src/index.js';

describe('relation graph inference', () => {
  it('infers forward population and inverse virtual types from one edge', async () => {
    const people = orm.schema({ name: orm.string(), email: orm.string().hidden() });
    const projects = orm.schema({
      owner: orm.objectId(),
      title: orm.string(),
      score: orm.number(),
      internal: orm.string().hidden(),
    });
    const base = orm.defineSchemas({ people, projects });
    const registry = base.defineRelations({
      projects: { owner: { ref: 'people', inverse: 'projects' } },
    });

    const database = {} as ReturnType<typeof createDatabase<typeof registry>>;
    const populated = await database.projects
      .find()
      .populate([{ ref: 'owner', fields: ['name', '+email'] }]);
    const personName: string | undefined = populated[0]!.owner?.name;
    const personEmail: string | undefined = populated[0]!.owner?.email;
    const ownerId: ObjectId | undefined = populated[0]!.owner?._id;
    const localField =
      expectTypeOf<(typeof registry.projects.relationMap)['owner']['localField']>();
    const virtualForeign =
      expectTypeOf<(typeof registry.people.virtualMap)['projects']['foreign']>();
    localField.toEqualTypeOf<'owner'>();
    virtualForeign.toEqualTypeOf<'owner'>();
    void personName;
    void personEmail;
    void ownerId;

    // @ts-expect-error `+` only opts in schema fields marked hidden.
    database.projects.find().populate([{ ref: 'owner', fields: ['+name'] }]);
    // @ts-expect-error Selectors must exist on the target schema.
    database.projects.find().populate([{ ref: 'owner', fields: ['missing'] }]);
    // @ts-expect-error Population specs use `fields`, not `select`.
    database.projects.find().populate([{ ref: 'owner', select: ['name'] }]);

    const projectsResult = await database.people
      .find()
      .virtual([{ virtual: 'projects', type: 'many', fields: ['title', '+internal'] }]);
    const title: string | undefined = projectsResult[0]!.projects[0]?.title;
    const internal: string | undefined = projectsResult[0]!.projects[0]?.internal;
    // @ts-expect-error Only selected fields are exposed.
    void projectsResult[0]!.projects[0]?.score;
    void title;
    void internal;

    const allFields = await database.people
      .find()
      .virtual([{ virtual: 'projects', type: 'many', fields: ['$all', '+internal'] }]);
    const score: number | undefined = allFields[0]!.projects[0]?.score;
    void score;

    // @ts-expect-error Population specs use `fields`, not separate `select`/`show` arrays.
    database.people.find().virtual([{ virtual: 'projects', type: 'many', select: ['title'] }]);
    database.people
      .find()
      // @ts-expect-error `$all` cannot be combined with a numeric aggregate.
      .virtual([
        {
          virtual: 'projects',
          type: 'many',
          aggregate: { field: 'score', type: 'sum' },
          fields: ['$all'],
        },
      ]);

    const aggregate = await database.people
      .find()
      .virtual([
        { virtual: 'projects', type: 'many', aggregate: { field: 'score', type: 'average' } },
      ]);
    const average: number | null = aggregate[0]!.projects;
    void average;

    const first = await database.people.find().virtual([{ virtual: 'projects', type: 'first' }]);
    const firstProject: string | undefined = first[0]!.projects?.title;
    void firstProject;

    // @ts-expect-error Relation declarations require explicit object form.
    registry.defineRelations({ projects: { owner: 'people' } });
    database.people
      .find()
      // @ts-expect-error Non-numeric target fields cannot be aggregated.
      .virtual([
        { virtual: 'projects', type: 'many', aggregate: { field: 'title', type: 'count' } },
      ]);
    database.people
      .find()
      // @ts-expect-error `first` does not support aggregates.
      .virtual([
        { virtual: 'projects', type: 'first', aggregate: { field: 'score', type: 'sum' } },
      ]);
    // @ts-expect-error Virtual loading is not available through populate.
    database.people.find().populate([{ virtual: 'projects', type: 'many' }]);
    database.projects
      .find()
      .populate([{ ref: 'owner' }])
      // @ts-expect-error Query-level population APIs are mutually exclusive.
      .virtual([{ virtual: 'projects', type: 'many' }]);
  });

  it('rejects non-ObjectId relation paths and accepts scopes with both spec kinds', () => {
    const people = orm.schema({ name: orm.string(), department: orm.objectId() });
    const projects = orm.schema({ owner: orm.objectId(), title: orm.string() });
    const base = orm.defineSchemas({ people, projects });

    // @ts-expect-error Relation fields must be ObjectId paths.
    base.defineRelations({ people: { name: { ref: 'projects' } } });
    // @ts-expect-error Relation keys must name fields declared on the source schema.
    base.defineRelations({ people: { notAField: { ref: 'projects' } } });

    const registry = base
      .defineRelations({
        projects: { owner: { ref: 'people', inverse: 'projects' } },
        people: { department: { ref: 'projects' } },
      })
      .defineScopes({
        people: {
          overview: [
            { ref: 'department' },
            { virtual: 'projects', type: 'many', fields: ['title'] },
          ],
        },
      });
    const database = {} as ReturnType<typeof createDatabase<typeof registry>>;
    expectTypeOf(database.people.find().with('overview')).not.toBeNever();
  });

  it('rejects duplicate inverse names on the same target schema', () => {
    const people = orm.schema({ name: orm.string() });
    const projects = orm.schema({ owner: orm.objectId() });
    const tasks = orm.schema({ assignee: orm.objectId() });
    const base = orm.defineSchemas({ people, projects, tasks });

    // @ts-expect-error Inverse names must be unique on their target schema.
    base.defineRelations({
      projects: { owner: { ref: 'people', inverse: 'work' } },
      tasks: { assignee: { ref: 'people', inverse: 'work' } },
    });

    base.defineRelations({
      projects: { owner: { ref: 'people', inverse: 'ownedProjects' } },
      tasks: { assignee: { ref: 'people', inverse: 'assignedTasks' } },
    });

    const withProjectInverse = base.defineRelations({
      projects: { owner: { ref: 'people', inverse: 'projects' } },
    });
    expectTypeOf(withProjectInverse.people.virtualMap.projects.foreign).toEqualTypeOf<'owner'>();
    // @ts-expect-error Inverse names cannot collide across defineRelations calls either.
    withProjectInverse.defineRelations({
      tasks: { assignee: { ref: 'people', inverse: 'projects' } },
    });
  });
});
