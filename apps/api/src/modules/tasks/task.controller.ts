import { BaseController } from '@/common/base.controller';
import { db } from '@/database';
import type { ApiHandler } from '@/libraries/response';
import { paramsSchema } from '@/libraries/schemas';
import { taskSchema, transitionSchema } from '@/modules/tasks/task.schema';
import { TaskService } from '@/modules/tasks/task.service';

const service = new TaskService();

export class TaskController extends BaseController<typeof db.tasks, typeof service> {
  constructor() {
    super({
      service,
      schema: taskSchema.definition,
    });
  }

  readonly changeStatus: ApiHandler = async (req, res) => {
    const { id } = paramsSchema.parse(req.params);
    const { status } = transitionSchema.parse(req.body);

    const task = await this.service.changeStatus(id, status);

    res.json({
      success: true,
      data: task,
    });
  };
}
