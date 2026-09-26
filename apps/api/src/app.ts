import express, { type Express } from 'express';

import { cors as base } from '@/middlewares/cors';
import { httpLog } from '@/middlewares/logger';
import { security } from '@/middlewares/security';

export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(httpLog);
  app.use(security);
  app.use(base);
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: false, limit: '1mb' }));

  app.get('/health/live', (_request, response) => {
    response.status(200).json({ status: 'ok' });
  });

  return app;
};
