import { ObjectId, createDatabase, orm } from '@mongorm/orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { env } from '@/libs/env';

const schemas = orm
  .defineSchemas({
    people: orm.schema({
      name: orm.string(),
      department: orm.string(),
    }),
    projects: orm.schema({
      company: orm.objectId(),
      key: orm.string(),
      owner: orm.objectId(),
      title: orm.string(),
      status: orm.enum(['active', 'complete']),
      internalNotes: orm.string().hidden(),
    }),
  })
  .defineRelations({
    projects: {
      owner: 'people',
    },
  })
  .defineVirtual({
    people: {
      projects: {
        ref: 'projects',
        localField: '_id',
        foreignField: 'owner',
      },
    },
  })
  .defineScopes({
    people: {
      projectSummary: [
        {
          virtual: 'projects',
          select: ['title', 'status'],
        },
      ],
    },
  });

const database = createDatabase({
  uri: env.MONGODB_URI,
  database: env.MONGODB_DATABASE,
  schemas,
});

const people = database.people;
const projects = database.projects;

describe('virtual population integration scenarios', () => {
  beforeAll(async () => database.connect());
  afterAll(async () => database.disconnect());
  afterEach(async () =>
    database.unsafe.purge({
      quiet: true,
    }),
  );

  it('simple: populates the projects belonging to one person', async () => {
    const person = await people.create({
      name: 'Ada Lovelace',
      department: 'Research',
    });
    const company = new ObjectId();
    await projects.create({
      company,
      key: 'ADA-ENGINE',
      owner: person._id,
      title: 'Analytical Engine',
      status: 'active',
      internalNotes: 'Early computing project',
    });

    const result = await people
      .find({
        _id: person._id,
      })
      .populate([
        {
          virtual: 'projects',
          select: ['title', 'status'],
        },
      ])
      .first();
    const [firstProject] = result?.projects ?? [];

    expect(result?.projects).toHaveLength(1);
    expect(firstProject?.title).toBe('Analytical Engine');
    expect(firstProject?.status).toBe('active');
    expect(firstProject).not.toHaveProperty('internalNotes');
  });

  it('negative: returns an empty array when the person has no projects', async () => {
    const person = await people.create({
      name: 'Alan Turing',
      department: 'Research',
    });

    const result = await people
      .find({
        _id: person._id,
      })
      .populate([
        {
          virtual: 'projects',
        },
      ])
      .first();

    expect(result?.projects).toEqual([]);
  });

  it('edge case: an outer projection retains the virtual join key', async () => {
    const person = await people.create({
      name: 'Katherine Johnson',
      department: 'Research',
    });
    const company = new ObjectId();
    await projects.create({
      company,
      key: 'KATHERINE-TRAJECTORY',
      owner: person._id,
      title: 'Orbital Trajectory',
      status: 'active',
      internalNotes: 'Flight calculations',
    });

    const result = await people
      .find({
        _id: person._id,
      })
      .select(['name'])
      .populate([
        {
          virtual: 'projects',
          select: ['title'],
        },
      ])
      .first();
    const [firstProject] = result?.projects ?? [];

    expect(result?.name).toBe('Katherine Johnson');
    expect(result?.projects).toHaveLength(1);
    expect(firstProject?.title).toBe('Orbital Trajectory');
  });

  it('negative: returns no parent results when the source filter does not match', async () => {
    const result = await people
      .find({
        name: 'No such person',
      })
      .populate([
        {
          virtual: 'projects',
        },
      ])
      .first();

    expect(result).toBeNull();
  });

  it('best case: keeps each person matched only to their own projects', async () => {
    const [ada, grace] = await people.bulk.create([
      {
        name: 'Ada Lovelace',
        department: 'Research',
      },
      {
        name: 'Grace Hopper',
        department: 'Platform',
      },
    ]);
    if (!ada || !grace) throw new Error('Expected the people fixtures to be created');

    await projects.bulk.create([
      {
        company: new ObjectId(),
        key: 'ADA-ENGINE',
        owner: ada._id,
        title: 'Analytical Engine',
        status: 'active',
        internalNotes: 'Research notes',
      },
      {
        company: new ObjectId(),
        key: 'ADA-NOTES',
        owner: ada._id,
        title: 'Computing Notes',
        status: 'complete',
        internalNotes: 'Published notes',
      },
      {
        company: new ObjectId(),
        key: 'GRACE-COMPILER',
        owner: grace._id,
        title: 'Compiler Validation',
        status: 'active',
        internalNotes: 'Compiler tests',
      },
    ]);

    const results = await people
      .find()
      .sort({
        name: 'asc',
      })
      .populate([
        {
          virtual: 'projects',
          select: ['title'],
        },
      ]);
    const [adaResult, graceResult] = results;
    const [firstAdaProject] = adaResult?.projects ?? [];

    expect(results).toHaveLength(2);
    expect(adaResult?.projects.map((project) => project.title)).toEqual([
      'Analytical Engine',
      'Computing Notes',
    ]);
    expect(graceResult?.projects.map((project) => project.title)).toEqual(['Compiler Validation']);
    expect(firstAdaProject).not.toHaveProperty('status');
    expect(firstAdaProject).not.toHaveProperty('internalNotes');
  });

  it('complex: applies a virtual scope and populates each project owner', async () => {
    const person = await people.create({
      name: 'Grace Hopper',
      department: 'Platform',
    });
    const company = new ObjectId();
    await projects.create({
      company,
      key: 'GRACE-COMPILER',
      owner: person._id,
      title: 'Compiler Validation',
      status: 'active',
      internalNotes: 'Regression suite',
    });

    const scoped = await people
      .find({
        _id: person._id,
      })
      .with('projectSummary')
      .first();
    const [scopedProject] = scoped?.projects ?? [];
    expect(scoped?.projects).toHaveLength(1);
    expect(scopedProject?.title).toBe('Compiler Validation');
    expect(scopedProject?.status).toBe('active');
    expect(scopedProject).not.toHaveProperty('internalNotes');

    const nested = await people
      .find({
        _id: person._id,
      })
      .populate([
        {
          virtual: 'projects',
          select: ['title', 'owner'],
          populate: [
            {
              ref: 'owner',
              select: ['name'],
            },
          ],
        },
      ]);
    const [nestedPerson] = nested;
    const [nestedProject] = nestedPerson?.projects ?? [];

    expect(nestedProject?.owner?.name).toBe('Grace Hopper');
  });

  it('real world: projects a tenant directory with each person’s active work', async () => {
    const [ada, alan, otherTenant] = await people.bulk.create([
      {
        name: 'Ada Lovelace',
        department: 'Research',
      },
      {
        name: 'Alan Turing',
        department: 'Research',
      },
      {
        name: 'Ada Lovelace',
        department: 'Operations',
      },
    ]);
    if (!ada || !alan || !otherTenant)
      throw new Error('Expected the directory fixtures to be created');

    await projects.bulk.create([
      {
        company: new ObjectId(),
        key: 'RESEARCH-ENGINE',
        owner: ada._id,
        title: 'Analytical Engine',
        status: 'active',
        internalNotes: 'Tenant research work',
      },
      {
        company: new ObjectId(),
        key: 'RESEARCH-NOTES',
        owner: ada._id,
        title: 'Computing Notes',
        status: 'complete',
        internalNotes: 'Archived work',
      },
      {
        company: new ObjectId(),
        key: 'OPERATIONS-DASHBOARD',
        owner: otherTenant._id,
        title: 'Operations Dashboard',
        status: 'active',
        internalNotes: 'Different department',
      },
    ]);

    const directory = await people
      .find({
        department: 'Research',
      })
      .select(['name', 'department'])
      .sort({
        name: 'asc',
      })
      .populate([
        {
          virtual: 'projects',
          select: ['title', 'status'],
        },
      ]);
    const [researchAda, researchAlan] = directory;
    const [firstResearchProject, secondResearchProject] = researchAda?.projects ?? [];

    expect(directory).toHaveLength(2);
    expect(researchAda?.projects).toHaveLength(2);
    expect(firstResearchProject?.title).toBe('Analytical Engine');
    expect(firstResearchProject?.status).toBe('active');
    expect(secondResearchProject?.title).toBe('Computing Notes');
    expect(secondResearchProject?.status).toBe('complete');
    expect(researchAlan?.name).toBe('Alan Turing');
    expect(researchAlan?.projects).toEqual([]);
    expect(directory.every((person) => person.department === 'Research')).toBe(true);
  });
});
