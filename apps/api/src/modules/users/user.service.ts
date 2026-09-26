import { BaseService } from '@/common/base.service';
import { db } from '@/database';

export class UserService extends BaseService<typeof db.users> {
  constructor() {
    super({
      name: 'User',
      model: db.users,
      softdelete: db.users.features.softdelete,
      scopes: {
        list: 'list',
        detail: 'detail',
      },
    });
  }
}
