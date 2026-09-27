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
      company: { ref: 'companies', inverse: 'projects' },
      owner: { ref: 'users', inverse: 'ownedProjects' },
    },
    tasks: {
      project: { ref: 'projects', inverse: 'tasks' },
      createdBy: { ref: 'users' },
      assignee: { ref: 'users', inverse: 'assignedTasks' },
    },
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
