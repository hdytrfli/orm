import { db } from '@/libs/database';
import { log } from '@/utils/logger';

await db.connect();

try {
  log.info({ context: 'application', value: 'Mongorm example is connected' }, 'data');
  log.info({ context: 'models', value: ['users', 'groups', 'companies'] }, 'data');
} finally {
  await db.disconnect();
}
