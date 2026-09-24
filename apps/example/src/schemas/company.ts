import { orm } from '@mongorm/orm';

import { COMPANY_PLANS } from '@/libs/constants';

export const companySchema = orm
  .schema({
    slug: orm.string().regex(/^[a-z0-9-]+$/),
    name: orm.string(),
    domain: orm.email().optional(),
    description: orm.string().optional(),
    plan: orm.enum(COMPANY_PLANS),
    settings: orm.object({
      timezone: orm.string(),
      weeklyDigest: orm.boolean(),
      maxMembers: orm.number().int().positive(),
    }),
  })
  .options({ timestamps: true, softdelete: true })
  .indexes([
    {
      fields: {
        slug: 1,
      },
      options: {
        unique: true,
        name: 'company_slug_unique',
      },
    },
    {
      fields: {
        deletedAt: 1,
        domain: 1,
      },
      options: {
        sparse: true,
        name: 'company_domain_lookup',
      },
    },
  ]);
