import { BaseService } from '@/common/base.service';
import { db } from '@/database';

export class ProjectService extends BaseService<typeof db.projects> {
  constructor() {
    super({
      name: 'Project',
      model: db.projects,
      softdelete: db.projects.features.softdelete,
      scopes: {
        list: 'list',
        detail: 'detail',
      },
    });
  }
}
