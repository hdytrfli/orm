import { Router } from 'express';

import { projectRouter } from '@/modules/projects/project.router';
import { taskRouter } from '@/modules/tasks/task.router';
import { userRouter } from '@/modules/users/user.router';

export const routers = Router()
  .use('/users', userRouter)
  .use('/projects', projectRouter)
  .use('/tasks', taskRouter);
