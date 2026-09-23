import * as dotenv from 'dotenv';
import * as z from 'zod';

dotenv.config({
  quiet: true,
});

const schema = z.object({
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  MONGODB_DATABASE: z.string().min(1, 'MONGODB_DATABASE is required'),
  FAKER_SEED: z.coerce.number().int().default(20260922),
});

/** Validated environment configuration for the example application. */
export const env = schema.parse(process.env);
export type Env = z.infer<typeof schema>;
