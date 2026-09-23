import * as dotenv from 'dotenv';
import * as z from 'zod';

dotenv.config({
  quiet: true,
});

const AVAILABLE_LEVELS = ['fatal', 'error', 'warn', 'info', 'debug', 'trace'] as const;

const schema = z.object({
  MONGODB_URI: z.string(),
  MONGODB_DATABASE: z.string(),
  FAKER_SEED: z.coerce.number(),
  LOG_LEVEL: z.enum(AVAILABLE_LEVELS),
});

/** Validated environment configuration for the example application. */
export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
