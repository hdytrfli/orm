import chalk from 'chalk';
import pino from 'pino';

import { env } from '@/libs/env';

/** Structured application logger with readable local output. */
export const log = pino({
  level: env.LOG_LEVEL,
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      ignore: 'pid,hostname,context,value',
      singleLine: false,
      messageFormat: '[{context}]\n{value}',
      translateTime: 'HH:MM:ss',
    },
  },
  formatters: {
    log: (object) => {
      if ('value' in object) {
        const stringified = '\n' + JSON.stringify(object.value, null, 2);
        const formatted = chalk.gray(stringified);

        return {
          ...object,
          value: formatted,
        };
      }
      return object;
    },
  },
});
