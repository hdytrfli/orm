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
    projects: { owner: { ref: 'users' } },
    tasks: {
      reporter: { ref: 'users' },
      project: { ref: 'projects' },
      assignee: { ref: 'users' },
    },
  })
  .defineVirtuals({
    users: {
      ownedProjects: { ref: 'projects', via: 'owner' },
      assignedTasks: { ref: 'tasks', via: 'assignee' },
    },
    projects: { tasks: { ref: 'tasks', via: 'project' } },
  })
  .defineScopes({
    users: {
      list: [
        {
          ref: 'ownedProjects',
          fields: ['key', 'name', 'status', 'description'],
        },
      ],
      detail: [
        {
          ref: 'ownedProjects',
          fields: ['key', 'name', 'status', 'description'],
        },
        {
          ref: 'assignedTasks',
          fields: ['title', 'status', 'priority', 'dueAt'],
        },
      ],
    },
    projects: {
      list: [
        { ref: 'owner', fields: ['firstName', 'lastName'] },
        {
          ref: 'tasks',
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
          ref: 'tasks',
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
