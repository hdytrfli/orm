import { createDatabase } from '@mongorm/orm';

import { env } from '@/libs/env';
import { schemas } from '@/schemas';

/** Shared database handle for the example application. */
export const db = createDatabase({
  schemas: schemas,
  uri: env.MONGODB_URI,
  database: env.MONGODB_DATABASE,
});
