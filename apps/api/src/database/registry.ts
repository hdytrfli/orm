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
    projects: { owner: 'users' },
    tasks: {
      project: 'projects',
      reporter: 'users',
      assignee: 'users',
    },
  })
  .defineVirtual({
    users: {
      ownedProjects: {
        ref: 'projects',
        local: '_id',
        foreign: 'owner',
        type: 'many',
        select: ['key', 'name', 'status', 'description'],
      },
      assignedTasks: {
        ref: 'tasks',
        local: '_id',
        foreign: 'assignee',
        type: 'many',
        select: ['title', 'status', 'priority', 'dueAt'],
      },
    },
    projects: {
      tasks: {
        ref: 'tasks',
        local: '_id',
        foreign: 'project',
        type: 'many',
        select: ['title', 'description', 'status', 'priority', 'dueAt', 'estimateMinutes'],
        show: ['updatedAt'],
      },
    },
  })
  .defineScopes({
    users: {
      list: [
        {
          virtual: 'ownedProjects',
        },
      ],
      detail: [
        {
          virtual: 'ownedProjects',
        },
        {
          virtual: 'assignedTasks',
        },
      ],
    },
    projects: {
      list: [{ ref: 'owner', select: ['firstName', 'lastName'] }, { virtual: 'tasks' }],
      detail: [
        { ref: 'owner', select: ['firstName', 'lastName', 'email', 'jobTitle'] },
        {
          virtual: 'tasks',
        },
      ],
    },
    tasks: {
      list: [
        { ref: 'project', select: ['key', 'name', 'status'] },
        { ref: 'assignee', select: ['firstName', 'lastName'] },
      ],
      detail: [
        {
          ref: 'project',
          select: ['key', 'name', 'status', 'description', 'targetAt'],
          populate: [
            {
              ref: 'owner',
              select: ['firstName', 'lastName', 'email'],
            },
          ],
        },
        { ref: 'reporter', select: ['firstName', 'lastName', 'email'] },
        { ref: 'assignee', select: ['firstName', 'lastName', 'email', 'jobTitle'] },
      ],
    },
  });
