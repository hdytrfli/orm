import { BaseService } from '@/common/base.service';
import { db } from '@/database';

export class ProjectService extends BaseService<typeof db.projects> {
  constructor() {
    super({
      name: 'Project',
      model: db.projects,
      softDelete: db.projects.features.softDelete,
      scopes: {
        list: 'list',
        detail: 'detail',
      },
    });
  }
}
