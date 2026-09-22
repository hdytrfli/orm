import { orm } from '@mongorm/orm';

export const companySchema = orm.schema({
  name: orm.string(),
  description: orm.string().optional(),
});
