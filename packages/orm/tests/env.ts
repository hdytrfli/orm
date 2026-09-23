import * as dotenv from 'dotenv';
import * as z from 'zod';

dotenv.config({
  quiet: true,
});

const schema = z.object({
  MONGODB_URI: z.string().min(1),
  MONGODB_DATABASE: z.string().min(1),
});

/** Required MongoDB integration-test configuration. */
export const env = schema.parse(process.env);
