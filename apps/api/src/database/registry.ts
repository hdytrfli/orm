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
          select: ['key', 'name', 'status', 'description'],
        },
      ],
      detail: [
        {
          type: 'many',
          virtual: 'ownedProjects',
          select: ['key', 'name', 'status', 'description'],
        },
        {
          type: 'many',
          virtual: 'assignedTasks',
          select: ['title', 'status', 'priority', 'dueAt'],
        },
      ],
    },
    projects: {
      list: [
        { ref: 'owner', select: ['firstName', 'lastName'] },
        {
          type: 'many',
          virtual: 'tasks',
          show: ['updatedAt'],
          select: ['title', 'description', 'status', 'priority', 'dueAt', 'estimateMinutes'],
        },
      ],
      detail: [
        { ref: 'owner', select: ['firstName', 'lastName', 'email', 'jobTitle'] },
        {
          type: 'many',
          virtual: 'tasks',
          show: ['updatedAt'],
          select: ['title', 'description', 'status', 'priority', 'dueAt', 'estimateMinutes'],
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
