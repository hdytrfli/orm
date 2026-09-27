import { BaseController } from '@/common/base.controller';
import { db } from '@/database';
import { projectSchema } from '@/modules/projects/project.schema';
import { ProjectService } from '@/modules/projects/project.service';

const service = new ProjectService();

export class ProjectController extends BaseController<typeof db.projects, typeof service> {
  constructor() {
    super({
      service,
      schema: projectSchema.definition,
    });
  }
}
