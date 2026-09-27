import { orm } from '@mongorm/orm';

import { projectSchema } from '@/modules/projects/project.schema';
import { taskSchema } from '@/modules/tasks/task.schema';
import { userSchema } from '@/modules/users/user.schema';

export const registry = orm
  .defineSchemas({
    users: userSchema,
    projects: projectSchema,
    tasks: taskSchema,
  })
  .defineRelations({
    projects: { owner: { ref: 'users', inverse: 'ownedProjects' } },
    tasks: {
      reporter: { ref: 'users' },
      project: { ref: 'projects', inverse: 'tasks' },
      assignee: { ref: 'users', inverse: 'assignedTasks' },
    },
  })
  .defineScopes({
    users: {
      list: [
        {
          virtual: 'ownedProjects',
          type: 'many',
          fields: ['key', 'name', 'status', 'description'],
        },
      ],
      detail: [
        {
          type: 'many',
          virtual: 'ownedProjects',
          fields: ['key', 'name', 'status', 'description'],
        },
        {
          type: 'many',
          virtual: 'assignedTasks',
          fields: ['title', 'status', 'priority', 'dueAt'],
        },
      ],
    },
    projects: {
      list: [
        { ref: 'owner', fields: ['firstName', 'lastName'] },
        {
          type: 'many',
          virtual: 'tasks',
          fields: [
            'title',
            'description',
            'status',
            'priority',
            'dueAt',
            'estimateMinutes',
            '+updatedAt',
          ],
        },
      ],
      detail: [
        { ref: 'owner', fields: ['firstName', 'lastName', 'email', 'jobTitle'] },
        {
          type: 'many',
          virtual: 'tasks',
          fields: [
            'title',
            'description',
            'status',
            'priority',
            'dueAt',
            'estimateMinutes',
            '+updatedAt',
          ],
        },
      ],
    },
    tasks: {
      list: [
        { ref: 'project', fields: ['key', 'name', 'status'] },
        { ref: 'assignee', fields: ['firstName', 'lastName'] },
      ],
      detail: [
        {
          ref: 'project',
          fields: ['key', 'name', 'status', 'description', 'targetAt'],
          populate: [
            {
              ref: 'owner',
              fields: ['firstName', 'lastName', 'email'],
            },
          ],
        },
        { ref: 'reporter', fields: ['firstName', 'lastName', 'email'] },
        { ref: 'assignee', fields: ['firstName', 'lastName', 'email', 'jobTitle'] },
      ],
    },
  });
