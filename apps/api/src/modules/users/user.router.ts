import { Router } from 'express';

import { UserController } from '@/modules/users/user.controller';

const userController = new UserController();
export const userRouter = Router()
  .get('/', userController.list)
  .post('/', userController.create)
  .get('/:id', userController.detail)
  .patch('/:id', userController.update)
  .delete('/:id', userController.remove)
  .post('/:id/restore', userController.restore);
