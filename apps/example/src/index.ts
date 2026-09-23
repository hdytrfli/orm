import { db } from '@/libs/database';
import { log } from '@/utils/logger';

await db.connect();

try {
  log('application', 'Mongorm example is connected');
  log('models', ['users', 'groups', 'companies']);
} finally {
  await db.disconnect();
}
