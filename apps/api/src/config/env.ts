import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const NODE_ENVIRONMENTS = ['development', 'test', 'production'] as const;
const LOG_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

const envSchema = z.object({
  LOG_LEVEL: z.enum(LOG_LEVELS),
  NODE_ENV: z.enum(NODE_ENVIRONMENTS),
  PORT: z.coerce.number(),
  MONGODB_URI: z.string(),
  MONGODB_DATABASE: z.string(),
  CORS_ORIGINS: z.string().transform((origins) =>
    origins
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  ),
});

export const env = envSchema.parse(process.env);
export type Environment = z.infer<typeof envSchema>;
