import { orm } from '@mongorm/orm';

import { companySchema } from '@/schemas/company';
import { groupSchema } from '@/schemas/group';
import { projectSchema } from '@/schemas/project';
import { taskSchema } from '@/schemas/task';
import { userSchema } from '@/schemas/user';

export const schemas = orm
  .defineSchemas({
    users: userSchema,
    tasks: taskSchema,
    groups: groupSchema,
    projects: projectSchema,
    companies: companySchema,
  })
  .defineRelations({
    groups: {
      company: { ref: 'companies' },
      creator: { ref: 'users' },
    },
    users: {
      group: { ref: 'groups' },
      company: { ref: 'companies' },
    },
    projects: {
      company: { ref: 'companies' },
      owner: { ref: 'users' },
    },
    tasks: {
      project: { ref: 'projects' },
      createdBy: { ref: 'users' },
      assignee: { ref: 'users' },
    },
  })
  .defineVirtuals({
    companies: { projects: { ref: 'projects', via: 'company' } },
    users: {
      ownedProjects: { ref: 'projects', via: 'owner' },
      assignedTasks: { ref: 'tasks', via: 'assignee' },
    },
    projects: { tasks: { ref: 'tasks', via: 'project' } },
  })
  .defineScopes({
    users: {
      detail: [
        {
          ref: 'group',
          fields: ['name'],
          populate: [
            {
              ref: 'creator',
              fields: ['$all', '+createdAt', '+updatedAt'],
            },
          ],
        },
        { ref: 'company' },
      ],
    },
    projects: {
      detail: [
        {
          ref: 'owner',
        },
        { ref: 'company' },
      ],
    },
    tasks: {
      detail: [
        {
          ref: 'project',
          populate: [
            {
              ref: 'owner',
            },
          ],
        },
        { ref: 'assignee' },
      ],
    },
  });
