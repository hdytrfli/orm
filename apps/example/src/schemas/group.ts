import { orm } from '@mongorm/orm';

export const groupSchema = orm
  .schema({
    company: orm.objectId(),
    name: orm.string(),
    creator: orm.objectId().optional(),
    description: orm.string().optional(),
    permissions: orm.object({
      canInvite: orm.boolean(),
      canManageBilling: orm.boolean(),
      canExportData: orm.boolean(),
    }),
  })
  .options({ timestamps: true, softdelete: true })
  .indexes([
    {
      fields: {
        name: 1,
      },
      options: {
        unique: true,
        name: 'group_name_per_company',
      },
    },
    {
      fields: {
        deletedAt: 1,
        company: 1,
      },
      options: {
        name: 'group_active_company',
      },
    },
  ]);
