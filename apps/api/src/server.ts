import { createApp } from '@/app';
import { env } from '@/config/env';
import { log } from '@/middlewares/http-logger';

const app = createApp();

const server = app.listen(env.PORT, () => {
  log.info({ port: env.PORT }, 'API server started');
});

const shutdown = (signal: NodeJS.Signals) => {
  log.info({ signal }, 'API server shutting down');

  server.close((error) => {
    if (error) {
      log.error({ err: error }, 'API server shutdown failed');
      process.exitCode = 1;
      return;
    }

    log.info('API server stopped');
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
