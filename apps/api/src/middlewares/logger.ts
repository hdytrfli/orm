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
  genReqId: (request) => request.headers['x-request-id']?.toString() ?? randomUUID(),
  serializers: {
    req: (request) => ({
      id: request.id,
      method: request.method,
      url: request.url?.split('?')[0],
      remoteAddress: request.remoteAddress,
    }),
  },
});
