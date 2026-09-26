import { orm } from '@mongorm/orm';

export const TASK_STATUSES = ['backlog', 'todo', 'in-progress', 'blocked', 'done'] as const;
export const TASK_PRIORITIES = ['low', 'normal', 'high', 'urgent'] as const;
export const TASK_SOURCES = ['manual', 'import', 'integration'] as const;

export const taskSchema = orm
  .schema({
    project: orm.objectId(),
    reporter: orm.objectId(),
    assignee: orm.objectId().nullable().optional(),
    title: orm.string().min(3).max(240),
    description: orm.string().max(8000).optional(),
    status: orm.enum(TASK_STATUSES),
    priority: orm.enum(TASK_PRIORITIES),
    labels: orm.string().array(),
    dueAt: orm.date().nullable().optional(),
    estimateMinutes: orm.number().int().positive().optional(),
    completedAt: orm.date().nullable().optional(),
    source: orm.object({
      kind: orm.enum(TASK_SOURCES),
      externalId: orm.string().optional(),
    }),
  })
  .options({ timestamps: true, softdelete: true, hideManaged: true })
  .indexes([
    {
      fields: { project: 1, status: 1, priority: -1, createdAt: -1 },
      options: { name: 'task_board' },
    },
    {
      fields: { assignee: 1, status: 1, dueAt: 1 },
      options: { name: 'task_assignee_due' },
    },
    {
      fields: { project: 1, source: 1 },
      options: {
        unique: true,
        sparse: true,
        name: 'task_external_source',
      },
    },
  ]);
