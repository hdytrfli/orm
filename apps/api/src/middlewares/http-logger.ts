import { randomUUID } from 'node:crypto';

import pino from 'pino';
import { pinoHttp } from 'pino-http';

import { env } from '@/config/env';

export const log = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password'],
    censor: '[REDACTED]',
  },
});

export const httpLog = pinoHttp({
  logger: log,
  genReqId: (request) => request.headers['x-request-id'] ?? randomUUID(),
  serializers: {
    req: (request) => {
      const [origin] = request.url ? request.url.split('?') : [];
      return {
        url: origin,
        id: request.id,
        method: request.method,
        remoteAddress: request.remoteAddress,
      };
    },
  },
});
