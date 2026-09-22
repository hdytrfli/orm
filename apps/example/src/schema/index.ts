import { orm } from '@mongorm/orm';

import { companySchema } from './company.js';
import { groupSchema } from './group.js';
import { userSchema } from './user.js';

export { companySchema } from './company.js';
export { groupSchema } from './group.js';
export { userSchema } from './user.js';

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
