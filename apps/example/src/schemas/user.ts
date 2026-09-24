import { orm } from '@mongorm/orm';

import { USER_ROLES } from '@/libs/constants';

export const userSchema = orm
  .schema({
    name: orm.string(),
    username: orm.string().min(3).toLowerCase().optional(),
    age: orm.number(),
    role: orm.enum(USER_ROLES),
    password: orm.string().hidden(),
    group: orm.objectId(),
    company: orm.objectId(),
    profile: orm.object({
      email: orm.string().hidden(),
      website: orm.url(),
      location: orm.object({
        city: orm.string(),
        country: orm.string().toUpperCase(),
      }),
    }),
  })
  .options({
    timestamps: true,
    softdelete: true,
  })
  .indexes([
    {
      fields: {
        company: 1,
        username: 1,
      },
      options: {
        unique: true,
        name: 'user_username_per_company',
        partialFilterExpression: {
          $and: [{ username: { $exists: true } }, { deletedAt: null }],
        },
      },
    },
    {
      fields: {
        deletedAt: 1,
        company: 1,
        role: 1,
      },
      options: {
        name: 'user_active_company_role',
      },
    },
  ]);
