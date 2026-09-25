import { demonstrateAggregation } from '@/examples/aggregation';
import { demonstrateCursors } from '@/examples/cursors';
import { demonstrateQueries } from '@/examples/queries';
import { demonstrateRelations } from '@/examples/relations';
import { demonstrateVirtualPopulation } from '@/examples/virtual';
import { demonstrateWrites } from '@/examples/writes';
import { db } from '@/libs/database';
import { log } from '@/utils/logger';

try {
  await db.connect();

  log.info({
    context: 'database',
    value: 'database connection established',
  });

  await db.sync({
    dropIndexes: true,
  });

  await Promise.all([
    db.tasks.purge({
      //
    }),

    db.projects.purge({
      //
    }),

    db.users.purge({
      //
    }),

    db.groups.purge({
      //
    }),

    db.companies.purge({
      //
    }),
  ]);

  log.info({
    context: 'database',
    value: 'example collections cleared and indexes synchronized',
  });

  await demonstrateQueries();
  await demonstrateRelations();
  await demonstrateVirtualPopulation();
  await demonstrateAggregation();
  await demonstrateCursors();
  await demonstrateWrites();
} finally {
  await db.disconnect();
}
