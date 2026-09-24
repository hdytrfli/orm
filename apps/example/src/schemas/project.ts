import { orm } from '@mongorm/orm';

import { PROJECT_STATUSES, PROJECT_VISIBILITIES } from '@/libs/constants';

export const projectSchema = orm
  .schema({
    company: orm.objectId(),
    owner: orm.objectId(),
    key: orm.string().toUpperCase(),
    name: orm.string().min(3),
    description: orm.string().optional(),
    status: orm.enum(PROJECT_STATUSES),
    visibility: orm.enum(PROJECT_VISIBILITIES),
    repository: orm.url().optional(),
    metadata: orm.object({
      color: orm.string(),
      tags: orm.string().array(),
    }),
  })
  .options({ timestamps: true, softdelete: true })
  .indexes([
    {
      fields: {
        company: 1,
        key: 1,
      },
      options: {
        unique: true,
        name: 'project_key_per_company',
        partialFilterExpression: {
          deletedAt: null,
        },
      },
    },
    {
      fields: {
        deletedAt: 1,
        company: 1,
        status: 1,
      },
      options: {
        name: 'project_active_status',
      },
    },
  ]);
