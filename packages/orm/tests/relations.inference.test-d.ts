import { describe, expect, expectTypeOf, it } from 'vitest';

import type { createDatabase } from '../src/index.js';
import { ObjectId, orm } from '../src/index.js';

describe('relation and schema-declared virtual inference', () => {
  it('infers forward populations and virtual result kinds from schema declarations', async () => {
    const people = orm.schema({
      name: orm.string(),
      email: orm.string().hidden(),
      projects: orm.virtual('many'),
      favoriteProject: orm.virtual('first'),
      maxScore: orm.virtual('max'),
      avgScore: orm.virtual('avg'),
      projectCount: orm.virtual('count'),
    });
    const projects = orm.schema({
      owner: orm.objectId(),
      title: orm.string(),
      score: orm.number(),
      internal: orm.string().hidden(),
    });
    const registry = orm
      .defineSchemas({ people, projects })
      .defineRelations({ projects: { owner: { ref: 'people' } } })
      .defineVirtuals({
        people: {
          projects: { ref: 'projects', via: 'owner' },
          favoriteProject: { ref: 'projects', via: 'owner' },
          maxScore: { ref: 'projects', via: 'owner', field: 'score' },
          avgScore: { ref: 'projects', via: 'owner', field: 'score' },
          projectCount: { ref: 'projects', via: 'owner' },
        },
      })
      .defineScopes({
        people: {
          detail: [
            { ref: 'projects', fields: ['title'] },
            { ref: 'favoriteProject', fields: ['title'] },
            { ref: 'maxScore' },
            { ref: 'projectCount' },
          ],
        },
      });

    const database = {} as ReturnType<typeof createDatabase<typeof registry>>;
    const populated = await database.projects
      .find()
      .populate([{ ref: 'owner', fields: ['name', '+email'] }]);
    const personName: string | undefined = populated[0]!.owner?.name;
    const personEmail: string | undefined = populated[0]!.owner?.email;
    const ownerId: ObjectId | undefined = populated[0]!.owner?._id;
    void personName;
    void personEmail;
    void ownerId;
    const populatedAll = await database.projects.find().populate([{ ref: 'owner' }]);
    const allName: string | undefined = populatedAll[0]!.owner?.name;
    void allName;

    const projectsResult = await database.people
      .find()
      .virtual([{ ref: 'projects', fields: ['title', '+internal'] }]);
    const title: string | undefined = projectsResult[0]!.projects[0]?.title;
    const internal: string | undefined = projectsResult[0]!.projects[0]?.internal;
    // @ts-expect-error Only selected fields are exposed.
    void projectsResult[0]!.projects[0]?.score;
    void title;
    void internal;

    const aggregate = await database.people
      .find()
      .virtual([{ ref: 'maxScore' }, { ref: 'avgScore' }, { ref: 'projectCount' }]);
    const maxScore: number | null = aggregate[0]!.maxScore;
    const average: number | null = aggregate[0]!.avgScore;
    const count: number = aggregate[0]!.projectCount;
    void maxScore;
    void average;
    void count;

    const first = await database.people
      .find()
      .virtual([{ ref: 'favoriteProject', fields: ['title'] }]);
    const firstProject: string | undefined = first[0]!.favoriteProject?.title;
    void firstProject;

    expectTypeOf(database.people.find().with('detail')).not.toBeNever();
    // @ts-expect-error Aggregate virtuals cannot project document fields.
    database.people.find().virtual([{ ref: 'maxScore', fields: ['score'] }]);
    // @ts-expect-error Virtual loading is not available through populate().
    database.people.find().populate([{ ref: 'projects' }]);
    const virtualQuery = database.people.find().virtual([{ ref: 'projects' }]);
    // @ts-expect-error Query-level population APIs are mutually exclusive.
    virtualQuery.populate([{ ref: 'owner' }]);
  });

  it('checks relation and virtual bindings against the declared registry', () => {
    const people = orm.schema({ name: orm.string(), projects: orm.virtual('many') });
    const projects = orm.schema({
      owner: orm.objectId(),
      score: orm.number(),
      title: orm.string(),
    });
    const base = orm.defineSchemas({ people, projects });
    expect(people.virtualDefinitions.projects?.kind).toBe('many');

    // @ts-expect-error Relation fields must be ObjectId paths.
    base.defineRelations({ people: { name: { ref: 'projects' } } });
    // @ts-expect-error Relation keys must name declared schema fields.
    base.defineRelations({ people: { notAField: { ref: 'projects' } } });

    const relations = base.defineRelations({ projects: { owner: { ref: 'people' } } });
    relations.defineVirtuals({
      people: {
        projects: {
          ref: 'projects',
          // @ts-expect-error The relation must point back to the virtual's owning schema.
          via: 'score',
        },
      },
    });
    relations.defineVirtuals({
      people: {
        // @ts-expect-error Aggregate bindings require a numeric field.
        projects: {
          ref: 'projects',
          via: 'owner',
          field: 'title',
        },
      },
    });
  });
});
