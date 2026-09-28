import { orm } from '@mongorm/orm';

export const PROJECT_STATUSES = ['planned', 'active', 'on-hold', 'completed'] as const;
export const PROJECT_VISIBILITIES = ['private', 'organization'] as const;

export const projectSchema = orm
  .schema({
    key: orm.string().min(2).max(12).toUpperCase(),
    name: orm.string().min(3).max(160),
    description: orm.string().max(4000).optional(),
    status: orm.enum(PROJECT_STATUSES),
    visibility: orm.enum(PROJECT_VISIBILITIES),
    owner: orm.objectId(),
    members: orm.objectId().array(),
    repositoryUrl: orm.url().nullable().optional(),
    startAt: orm.date().nullable().optional(),
    targetAt: orm.date().nullable().optional(),
    settings: orm.object({
      color: orm.string(),
      billable: orm.boolean(),
      defaultEstimateMinutes: orm.number().int().nonnegative(),
    }),
    labels: orm.string().array(),
    tasks: orm.virtual('many'),
    totalTasks: orm.virtual('count'),
  })
  .options({ timestamps: true, softdelete: true, hideManaged: true })
  .indexes([
    {
      fields: { key: 1 },
      options: {
        unique: true,
        name: 'project_key_active_unique',
        partialFilterExpression: { deletedAt: null },
      },
    },
    {
      fields: { status: 1, updatedAt: -1 },
      options: { name: 'project_status_updated' },
    },
    {
      fields: { owner: 1, status: 1 },
      options: { name: 'project_owner_status' },
    },
  ]);
