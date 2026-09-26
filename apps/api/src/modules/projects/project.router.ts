import { Router } from 'express';

import { ProjectController } from '@/modules/projects/project.controller';

export const projectController = new ProjectController();
export const projectRouter = Router()
  .get('/', projectController.list)
  .post('/', projectController.create)
  .get('/:id', projectController.detail)
  .patch('/:id', projectController.update)
  .delete('/:id', projectController.remove)
  .post('/:id/restore', projectController.restore);
