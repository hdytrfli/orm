import { createDatabase } from '@mongorm/orm';

import { env } from '@/config/env';
import { registry } from '@/database/registry';

export const db = createDatabase({
  uri: env.MONGODB_URI,
  database: env.MONGODB_DATABASE,
  schemas: registry,
});
