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
      ownedProjects: { ref: 'projects', localField: '_id', foreignField: 'owner' },
      assignedTasks: { ref: 'tasks', localField: '_id', foreignField: 'assignee' },
    },
    projects: {
      tasks: { ref: 'tasks', localField: '_id', foreignField: 'project' },
    },
  })
  .defineScopes({
    users: {
      list: [
        {
          virtual: 'ownedProjects',
          select: ['key', 'name', 'status'],
        },
      ],
      detail: [
        {
          virtual: 'ownedProjects',
          select: ['key', 'name', 'status', 'description'],
        },
        {
          virtual: 'assignedTasks',
          select: ['title', 'status', 'priority', 'dueAt'],
        },
      ],
    },
    projects: {
      list: [
        { ref: 'owner', select: ['firstName', 'lastName'] },
        { virtual: 'tasks', select: ['title', 'status', 'priority'] },
      ],
      detail: [
        { ref: 'owner', select: ['firstName', 'lastName', 'email', 'jobTitle'] },
        {
          virtual: 'tasks',
          select: ['title', 'description', 'status', 'priority', 'dueAt', 'estimateMinutes'],
          populate: [{ ref: 'assignee', select: ['firstName', 'lastName', 'email'] }],
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
          populate: [{ ref: 'owner', select: ['firstName', 'lastName', 'email'] }],
        },
        { ref: 'reporter', select: ['firstName', 'lastName', 'email'] },
        { ref: 'assignee', select: ['firstName', 'lastName', 'email', 'jobTitle'] },
      ],
    },
  });
