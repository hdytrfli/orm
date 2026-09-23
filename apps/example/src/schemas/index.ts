import { orm } from '@mongorm/orm';

import { companySchema } from '@/schemas/company';
import { groupSchema } from '@/schemas/group';
import { userSchema } from '@/schemas/user';

export { companySchema } from '@/schemas/company';
export { groupSchema } from '@/schemas/group';
export { userSchema } from '@/schemas/user';

export const schema = orm
  .defineSchemas({
    users: userSchema,
    groups: groupSchema,
    companies: companySchema,
  })
  .defineRelations({
    groups: { creator: 'users' },
    users: { group: 'groups', company: 'companies' },
  })
  .defineScopes({
    users: {
      detail: [
        {
          ref: 'group',
          select: ['name'],
          populate: [{ ref: 'creator' }],
        },
        { ref: 'company' },
      ],
    },
  });
