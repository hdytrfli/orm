import { createDatabase, orm } from '@mongorm/orm';
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest';

import { env } from '@/libs/env';

const schemas = orm
  .defineSchemas({
    companies: orm.schema({ name: orm.string() }),
    departments: orm.schema({ name: orm.string(), company: orm.objectId() }),
    people: orm.schema({
      name: orm.string(),
      email: orm.email().hidden(),
      profile: orm.object({ department: orm.objectId() }),
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
      owner: { ref: 'people', inverse: 'ownedProjects' },
      company: { ref: 'companies', inverse: 'projects' },
    },
    tasks: {
      owner: { ref: 'people', inverse: 'tasks' },
      project: { ref: 'projects', inverse: 'tasks' },
    },
    people: {
      'profile.department': { ref: 'departments', inverse: 'employees' },
    },
    departments: {
      company: { ref: 'companies' },
    },
  })
  .defineScopes({
    departments: {
      overview: [
        { ref: 'company', select: ['name'] },
        { virtual: 'employees', type: 'many', select: ['name'] },
      ],
    },
  });

const database = createDatabase({ uri: env.MONGODB_URI, database: env.MONGODB_DATABASE, schemas });
const people = database.people;
const projects = database.projects;
const departments = database.departments;
const companies = database.companies;

describe('graph-based virtual population', () => {
  beforeAll(async () => database.connect());
  afterAll(async () => database.disconnect());
  afterEach(async () => database.unsafe.purge({ quiet: true }));

  it('derives reverse virtuals from forward relation edges', async () => {
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
      .virtual([{ virtual: 'ownedProjects', type: 'many', select: ['title'] }])
      .first();
    expect(result?.ownedProjects.map(({ title }) => title)).toEqual(['Analytical Engine']);
    expect(result?.ownedProjects[0]).not.toHaveProperty('internalNotes');

    const reverseEmployee = await departments
      .find({ _id: department._id })
      .virtual([{ virtual: 'employees', type: 'first', select: ['name'], show: ['email'] }])
      .first();
    expect(reverseEmployee?.employees?.name).toBe('Ada Lovelace');
    expect(reverseEmployee?.employees?.email).toBe('ada@example.test');
  });

  it('supports query-time aggregates and cardinality without definition duplication', async () => {
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

    const counted = await people
      .find({ _id: person._id })
      .virtual([
        { virtual: 'ownedProjects', type: 'many', aggregate: { field: 'score', type: 'count' } },
      ])
      .first();
    expect(counted?.ownedProjects).toBe(2);

    const averaged = await people
      .find({ _id: person._id })
      .virtual([
        { virtual: 'ownedProjects', type: 'many', aggregate: { field: 'score', type: 'average' } },
      ])
      .first();
    expect(averaged?.ownedProjects).toBe(6);

    const first = await people
      .find({ _id: person._id })
      .virtual([{ virtual: 'ownedProjects', type: 'first', select: ['title'] }])
      .first();
    expect(first?.ownedProjects?.title).toBe('One');
  });

  it('keeps populate and virtual as distinct query operations and allows mixed scopes', async () => {
    const company = await companies.create({ name: 'Research Co' });
    const department = await departments.create({ name: 'Research', company: company._id });
    await people.create({
      name: 'Ada Lovelace',
      email: 'ada@example.test',
      profile: { department: department._id },
    });

    const result = await departments.find({ _id: department._id }).with('overview').first();
    expect(result?.company?.name).toBe('Research Co');
    expect(result?.employees.map(({ name }) => name)).toEqual(['Ada Lovelace']);
  });
});
