import { ObjectId, createDatabase, orm } from '@mongorm/orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { env } from '@/libs/env';

const schemas = orm
  .defineSchemas({
    companies: orm.schema({
      slug: orm.string(),
      name: orm.string(),
      description: orm.string(),
    }),
    departments: orm.schema({
      name: orm.string(),
      description: orm.string(),
      company: orm.objectId(),
    }),
    people: orm.schema({
      name: orm.string(),
      email: orm.email(),
      profile: orm.object({
        department: orm.objectId(),
      }),
    }),
    projects: orm.schema({
      company: orm.objectId(),
      key: orm.string(),
      owner: orm.objectId(),
      department: orm.objectId().optional(),
      title: orm.string(),
      status: orm.enum(['active', 'complete']),
      internalNotes: orm.string().hidden(),
    }),
    tasks: orm.schema({
      title: orm.string(),
      owner: orm.objectId(),
      project: orm.objectId(),
    }),
  })
  .defineRelations({
    projects: { owner: 'people', company: 'companies' },
    tasks: { owner: 'people', project: 'projects' },
    people: { 'profile.department': 'departments' },
  })
  .defineVirtual({
    people: {
      projects: {
        ref: 'projects',
        localField: '_id',
        foreignField: 'owner',
      },
      departmentProjects: {
        ref: 'projects',
        localField: 'profile.department',
        foreignField: 'department',
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
const departments = database.departments;
const companies = database.companies;

const createDepartment = async (name: string) => {
  const company = await companies.create({
    slug: `virtual-${name.toLowerCase()}-${new ObjectId().toHexString()}`,
    name: `${name} Company`,
    description: `Company supporting ${name}`,
  });

  return departments.create({
    name,
    description: `${name} department`,
    company: company._id,
  });
};

const createPerson = async (name: string, departmentId: ObjectId) =>
  people.create({
    name,
    email: `${name.toLowerCase().replaceAll(' ', '.')}@example.test`,
    profile: { department: departmentId },
  });

describe('virtual population integration scenarios', () => {
  beforeAll(async () => database.connect());
  afterAll(async () => database.disconnect());
  afterEach(async () =>
    database.unsafe.purge({
      quiet: true,
    }),
  );

  it('simple: populates the projects belonging to one person', async () => {
    const research = await createDepartment('Research');
    const person = await createPerson('Ada Lovelace', research._id);

    const company = new ObjectId();

    await projects.create({
      company,
      key: 'ADA-ENGINE',
      owner: person._id,
      department: research._id,
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
    const research = await createDepartment('Research');
    const person = await createPerson('Alan Turing', research._id);

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
    const research = await createDepartment('Research');
    const person = await createPerson('Katherine Johnson', research._id);
    const company = new ObjectId();
    await projects.create({
      company,
      key: 'KATHERINE-TRAJECTORY',
      owner: person._id,
      department: research._id,
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

  it('nested reference: populates an ObjectId stored inside a nested object', async () => {
    const research = await createDepartment('Research');
    const person = await createPerson('Katherine Johnson', research._id);

    const result = await people
      .find({ _id: person._id })
      .populate([{ ref: 'profile.department', select: ['name'] }])
      .first();

    expect(result?.profile.department?.name).toBe('Research');
    expect(result?.profile.department).not.toHaveProperty('description');
  });

  it('nested virtual join: matches projects using a nested department ObjectId', async () => {
    const research = await createDepartment('Research');
    const person = await createPerson('Ada Lovelace', research._id);
    const differentOwner = await createPerson('Grace Hopper', research._id);
    const company = new ObjectId();
    await projects.create({
      company,
      key: 'SHARED-DEPARTMENT-PROJECT',
      owner: differentOwner._id,
      department: research._id,
      title: 'Department-wide Research',
      status: 'active',
      internalNotes: 'Shared with the whole department',
    });

    const result = await people
      .find({ _id: person._id })
      .populate([{ virtual: 'departmentProjects', select: ['title'] }])
      .first();
    const [firstProject] = result?.departmentProjects ?? [];

    expect(result?.departmentProjects).toHaveLength(1);
    expect(firstProject?.title).toBe('Department-wide Research');
    expect(firstProject).not.toHaveProperty('internalNotes');
  });

  it('best case: keeps each person matched only to their own projects', async () => {
    const research = await createDepartment('Research');
    const platform = await createDepartment('Platform');
    const ada = await createPerson('Ada Lovelace', research._id);
    const grace = await createPerson('Grace Hopper', platform._id);

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
    const platform = await createDepartment('Platform');
    const person = await createPerson('Grace Hopper', platform._id);
    const company = new ObjectId();
    await projects.create({
      company,
      key: 'GRACE-COMPILER',
      owner: person._id,
      department: platform._id,
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
    const research = await createDepartment('Research');
    const operations = await createDepartment('Operations');
    const ada = await createPerson('Ada Lovelace', research._id);
    await createPerson('Alan Turing', research._id);
    const otherTenant = await createPerson('Ada Lovelace', operations._id);

    await projects.bulk.create([
      {
        company: new ObjectId(),
        key: 'RESEARCH-ENGINE',
        owner: ada._id,
        department: research._id,
        title: 'Analytical Engine',
        status: 'active',
        internalNotes: 'Tenant research work',
      },
      {
        company: new ObjectId(),
        key: 'RESEARCH-NOTES',
        owner: ada._id,
        department: research._id,
        title: 'Computing Notes',
        status: 'complete',
        internalNotes: 'Archived work',
      },
      {
        company: new ObjectId(),
        key: 'OPERATIONS-DASHBOARD',
        owner: otherTenant._id,
        department: operations._id,
        title: 'Operations Dashboard',
        status: 'active',
        internalNotes: 'Different department',
      },
    ]);

    const directory = await people
      .find({
        'profile.department': research._id,
      })
      .select(['name', 'profile.department'])
      .sort({
        name: 'asc',
      })
      .populate([
        {
          ref: 'profile.department',
          select: ['name'],
        },
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
    expect(researchAda?.profile.department?.name).toBe('Research');
    expect(researchAlan?.profile.department?.name).toBe('Research');
  });
});
