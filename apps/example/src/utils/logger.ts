import pino from 'pino';

import { env } from '@/libs/env';

/** Structured application logger with readable local output. */
export const logger = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      messageFormat: '[{context}] {msg}',
      singleLine: true,
      translateTime: 'SYS:standard',
    },
  },
});

export const log = (context: string, value: unknown): void => {
  logger.info({ context, value }, 'data');
};
