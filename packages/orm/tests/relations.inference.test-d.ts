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
    });
    const base = orm.defineSchemas({ people, projects });
    const registry = base.defineRelations({
      projects: { owner: { ref: 'people', inverse: 'projects' } },
    });

    const database = {} as ReturnType<typeof createDatabase<typeof registry>>;
    const populated = await database.projects.find().populate([{ ref: 'owner', select: ['name'] }]);
    const personName: string | undefined = populated[0]!.owner?.name;
    const ownerId: ObjectId | undefined = populated[0]!.owner?._id;
    const localField =
      expectTypeOf<(typeof registry.projects.relationMap)['owner']['localField']>();
    const virtualForeign =
      expectTypeOf<(typeof registry.people.virtualMap)['projects']['foreign']>();
    localField.toEqualTypeOf<'owner'>();
    virtualForeign.toEqualTypeOf<'owner'>();
    void personName;
    void ownerId;

    const projectsResult = await database.people
      .find()
      .virtual([{ virtual: 'projects', type: 'many', select: ['title'] }]);
    const title: string | undefined = projectsResult[0]!.projects[0]?.title;
    // @ts-expect-error Only selected fields are exposed.
    void projectsResult[0]!.projects[0]?.score;
    void title;

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
    database.people.find().virtual([
      // @ts-expect-error Non-numeric target fields cannot be aggregated.
      { virtual: 'projects', type: 'many', aggregate: { field: 'title', type: 'count' } },
    ]);
    database.people.find().virtual([
      // @ts-expect-error `first` does not support aggregates.
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
    const registry = base
      .defineRelations({
        projects: { owner: { ref: 'people', inverse: 'projects' } },
        people: { department: { ref: 'projects' } },
      })
      .defineScopes({
        people: {
          overview: [
            { ref: 'department' },
            { virtual: 'projects', type: 'many', select: ['title'] },
          ],
        },
      });
    const database = {} as ReturnType<typeof createDatabase<typeof registry>>;
    expectTypeOf(database.people.find().with('overview')).not.toBeNever();
  });
});
