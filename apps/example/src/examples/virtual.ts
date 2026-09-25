import { orm } from '@mongorm/orm';

import { db } from '@/libs/database';
import { log } from '@/utils/logger';

const virtualSchemas = orm
  .defineSchemas({
    people: orm.schema({ name: orm.string(), department: orm.string() }),
    projects: orm.schema({
      owner: orm.objectId(),
      title: orm.string(),
      status: orm.enum(['active', 'complete']),
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

/** Demonstrates reverse population without storing a projects array on people. */
export const demonstrateVirtualPopulation = async () => {
  const people = db.model('virtual_people', virtualSchemas.people);
  const projects = db.model('virtual_projects', virtualSchemas.projects);

  // These collections are specific to this example, so make reruns deterministic.
  await projects.delete({});
  await people.delete({});

  const [ada, grace, alan] = await people.bulk.create([
    { name: 'Ada Lovelace', department: 'Research' },
    { name: 'Grace Hopper', department: 'Platform' },
    { name: 'Alan Turing', department: 'Research' },
  ]);
  if (!ada || !grace || !alan) throw new Error('Expected virtual population example people');

  await projects.bulk.create([
    { owner: ada._id, title: 'Analytical Engine', status: 'active' },
    { owner: ada._id, title: 'Notes on computing', status: 'complete' },
    { owner: grace._id, title: 'Compiler validation', status: 'active' },
  ]);

  log.info({
    context: 'virtual population seed data',
    value: { people: [ada.name, grace.name, alan.name], projectCount: 3 },
  });

  // Populate each person with matching projects; people without projects get [].
  const projectLists = await people
    .find()
    .populate([{ virtual: 'projects', select: ['title', 'status'] }]);
  log.info({ context: 'people with virtual projects', value: projectLists });

  // A scope can include a virtual just like it can include a normal relation.
  const summaries = await people.find().with('projectSummary');
  log.info({ context: 'virtual population scope', value: summaries });

  // Virtual results can themselves populate ordinary forward relations.
  const projectsWithOwners = await people.find({ name: 'Ada Lovelace' }).populate([
    {
      virtual: 'projects',
      select: ['title', 'owner'],
      populate: [{ ref: 'owner', select: ['name'] }],
    },
  ]);
  log.info({ context: 'nested population inside a virtual', value: projectsWithOwners });
};
