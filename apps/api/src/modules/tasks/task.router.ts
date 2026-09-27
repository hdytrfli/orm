import { Router } from 'express';

import { TaskController } from '@/modules/tasks/task.controller';

export const taskController = new TaskController();
export const taskRouter = Router()
  .get('/', taskController.list)
  .post('/', taskController.create)
  .get('/:id', taskController.detail)
  .patch('/:id/status', taskController.changeStatus)
  .patch('/:id', taskController.update)
  .delete('/:id', taskController.remove)
  .post('/:id/restore', taskController.restore);
