import { createDatabase, orm } from '@mongorm/orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { env } from '@/libs/env';

const schemas = orm
  .defineSchemas({
    companies: orm.schema({ name: orm.string(), projects: orm.virtual('many') }),
    departments: orm.schema({
      name: orm.string(),
      company: orm.objectId(),
      employees: orm.virtual('first'),
    }),
    people: orm.schema({
      name: orm.string(),
      email: orm.email().hidden(),
      profile: orm.object({ department: orm.objectId() }),
      ownedProjects: orm.virtual('many'),
      maxScore: orm.virtual('max'),
      avgScore: orm.virtual('avg'),
      projectCount: orm.virtual('count'),
    }),
    projects: orm.schema({
      owner: orm.objectId(),
      company: orm.objectId(),
      key: orm.string(),
      department: orm.objectId().optional(),
      title: orm.string(),
      score: orm.number().optional(),
      status: orm.enum(['active', 'complete']),
      internalNotes: orm.string().hidden(),
    }),
    tasks: orm.schema({ title: orm.string(), owner: orm.objectId(), project: orm.objectId() }),
  })
  .defineRelations({
    projects: {
      owner: { ref: 'people' },
      company: { ref: 'companies' },
    },
    tasks: {
      owner: { ref: 'people' },
      project: { ref: 'projects' },
    },
    people: {
      'profile.department': { ref: 'departments' },
    },
    departments: {
      company: { ref: 'companies' },
    },
  })
  .defineVirtuals({
    companies: { projects: { ref: 'projects', via: 'company' } },
    departments: { employees: { ref: 'people', via: 'profile.department' } },
    people: {
      ownedProjects: { ref: 'projects', via: 'owner' },
      maxScore: { ref: 'projects', via: 'owner', field: 'score' },
      avgScore: { ref: 'projects', via: 'owner', field: 'score' },
      projectCount: { ref: 'projects', via: 'owner' },
    },
  })
  .defineScopes({
    departments: {
      overview: [
        { ref: 'company', fields: ['name'] },
        { ref: 'employees', fields: ['name'] },
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

describe('schema-declared virtual population', () => {
  beforeAll(async () => database.connect());
  afterAll(async () => database.disconnect());
  afterEach(async () => database.unsafe.purge({ quiet: true }));

  it('loads multiple virtuals over the same relation edge with declared cardinality', async () => {
    const company = await companies.create({ name: 'Research Co' });
    const department = await departments.create({ name: 'Research', company: company._id });
    const person = await people.create({
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      profile: { department: department._id },
    });
    await projects.create({
      owner: person._id,
      company: company._id,
      key: 'ADA-ENGINE',
      department: department._id,
      title: 'Analytical Engine',
      score: 10,
      status: 'active',
      internalNotes: 'private',
    });

    const result = await people
      .find({ _id: person._id })
      .virtual([
        {
          ref: 'ownedProjects',
          fields: ['title'],
        },
      ])
      .first();

    expect(result?.ownedProjects.map((project) => project.title)).toEqual(['Analytical Engine']);
    expect(result?.ownedProjects[0]).not.toHaveProperty('internalNotes');

    const reverseEmployee = await departments
      .find({ _id: department._id })
      .virtual([{ ref: 'employees', fields: ['$all', '+email'] }])
      .first();

    expect(reverseEmployee?.employees?.name).toBe('Ada Lovelace');
    expect(reverseEmployee?.employees?.email).toBe('ada@example.test');
    expect(reverseEmployee?.employees?.profile.department).toEqual(department._id);
  });

  it('calculates aggregates configured on virtual fields', async () => {
    const company = await companies.create({ name: 'Research Co' });
    const department = await departments.create({ name: 'Research', company: company._id });
    const person = await people.create({
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      profile: { department: department._id },
    });
    await projects.create({
      owner: person._id,
      company: company._id,
      key: 'ADA-ONE',
      title: 'One',
      score: 4,
      status: 'active',
      internalNotes: '',
    });
    await projects.create({
      owner: person._id,
      company: company._id,
      key: 'ADA-TWO',
      title: 'Two',
      score: 8,
      status: 'complete',
      internalNotes: '',
    });

    const aggregates = await people
      .find({ _id: person._id })
      .virtual([{ ref: 'projectCount' }, { ref: 'avgScore' }, { ref: 'maxScore' }])
      .first();

    expect(aggregates?.projectCount).toBe(2);
    expect(aggregates?.avgScore).toBe(6);
    expect(aggregates?.maxScore).toBe(8);
  });

  it('applies mixed relation and virtual specs through a scope', async () => {
    const company = await companies.create({ name: 'Research Co' });
    const department = await departments.create({ name: 'Research', company: company._id });
    await people.create({
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      profile: { department: department._id },
    });

    const result = await departments.find({ _id: department._id }).with('overview').first();
    expect(result?.company?.name).toBe('Research Co');
    expect(result?.employees?.name).toBe('Ada Lovelace');
  });
});
