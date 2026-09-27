import { BaseController } from '@/common/base.controller';
import { db } from '@/database';
import { userSchema } from '@/modules/users/user.schema';
import { UserService } from '@/modules/users/user.service';

const service = new UserService();

export class UserController extends BaseController<typeof db.users, typeof service> {
  constructor() {
    super({
      service,
      schema: userSchema.definition,
    });
  }
}
