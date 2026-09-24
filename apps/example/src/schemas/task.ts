import { orm } from '@mongorm/orm';

import { TASK_PRIORITIES, TASK_SOURCES, TASK_STATUSES } from '@/libs/constants';

export const taskSchema = orm
  .schema({
    project: orm.objectId(),
    createdBy: orm.objectId(),
    assignee: orm.objectId().optional(),
    title: orm.string().min(3),
    description: orm.string().optional(),
    status: orm.enum(TASK_STATUSES),
    priority: orm.enum(TASK_PRIORITIES),
    labels: orm.string().array(),
    dueAt: orm.date().nullable().optional(),
    estimateHours: orm.number().nonnegative().optional(),
    audit: orm.object({
      source: orm.enum(TASK_SOURCES),
      externalId: orm.string().optional(),
    }),
  })
  .options({ timestamps: true, softdelete: true })
  .indexes([
    {
      fields: {
        project: 1,
        status: 1,
        priority: -1,
      },
      options: {
        name: 'task_board_order',
      },
    },
    {
      fields: {
        assignee: 1,
        dueAt: 1,
      },
      options: {
        name: 'task_assignee_due_date',
        sparse: true,
      },
    },
  ]);
