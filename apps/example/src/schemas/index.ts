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
      company: 'companies',
      creator: 'users',
    },
    users: {
      group: 'groups',
      company: 'companies',
    },
    projects: {
      company: 'companies',
      owner: 'users',
    },
    tasks: {
      project: 'projects',
      createdBy: 'users',
      assignee: 'users',
    },
  })
  .defineScopes({
    users: {
      detail: [
        {
          ref: 'group',
          select: ['name'],
          populate: [
            {
              ref: 'creator',
              show: ['createdAt', 'updatedAt'],
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
