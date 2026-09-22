import { orm } from '@mongorm/orm';

export const groupSchema = orm.schema({
  name: orm.string(),
  creator: orm.objectId().optional(),
});
