import express, { type Express } from 'express';

import { bodyParser } from '@/middlewares/body-parser';
import { corsConfig } from '@/middlewares/cors-config';
import { errorHandler } from '@/middlewares/error-handler';
import { headerConfig } from '@/middlewares/header-config';
import { httpLog } from '@/middlewares/http-logger';
import { notFound } from '@/middlewares/not-found';
import { urlEncoder } from '@/middlewares/url-encoder';
import { routers } from '@/routes/api.router';

export const createApp = (): Express => {
  const app = express();

  app.disable('x-powered-by');

  app.use(httpLog);
  app.use(headerConfig);
  app.use(corsConfig);
  app.use(bodyParser);
  app.use(urlEncoder);

  app.get('/api/v1/health/live', (_request, response) => {
    response.status(200).json({
      success: true,
      data: {
        status: 'ok',
      },
    });
  });

  app.use('/api/v1', routers);
  app.use(notFound);
  app.use(errorHandler);

  return app;
};
