import { ObjectId } from '@mongorm/orm';

import { BaseService } from '@/common/base.service';
import { db } from '@/database';
import { NotFoundError } from '@/libraries/errors';
import { TASK_STATUSES } from '@/modules/tasks/task.schema';

type TaskStatus = (typeof TASK_STATUSES)[number];

export class TaskService extends BaseService<typeof db.tasks> {
  constructor() {
    super({
      name: 'Task',
      model: db.tasks,
      softDelete: db.tasks.features.softDelete,
      scopes: {
        list: 'list',
        detail: 'detail',
      },
    });
  }

  async changeStatus(id: ObjectId, status: TaskStatus) {
    const current = new Date();

    const updated = await this.model.update(
      {
        _id: id,
        $expr: {
          $in: [
            '$status',
            {
              $switch: {
                branches: [
                  {
                    case: {
                      $eq: [
                        {
                          $literal: status,
                        },
                        'todo',
                      ],
                    },
                    then: ['backlog', 'in-progress', 'blocked'],
                  },
                  {
                    case: {
                      $eq: [
                        {
                          $literal: status,
                        },
                        'in-progress',
                      ],
                    },
                    then: ['todo', 'blocked', 'done'],
                  },
                  {
                    case: {
                      $eq: [
                        {
                          $literal: status,
                        },
                        'blocked',
                      ],
                    },
                    then: ['todo', 'in-progress'],
                  },
                  {
                    case: {
                      $eq: [
                        {
                          $literal: status,
                        },
                        'done',
                      ],
                    },
                    then: ['in-progress'],
                  },
                ],
                default: [],
              },
            },
          ],
        },
      },
      {
        status,
        completedAt: status === 'done' ? current : null,
      },
    );

    if (!updated) throw new NotFoundError('Task');
    return updated;
  }
}
