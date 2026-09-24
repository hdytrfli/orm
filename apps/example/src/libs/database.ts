import { createDatabase } from '@mongorm/orm';

import { env } from '@/libs/env';
import { schema } from '@/schemas';

/** Shared database handle for the example application. */
export const db = createDatabase({
  uri: env.MONGODB_URI,
  database: env.MONGODB_DATABASE,
  schemas: schema,
});
