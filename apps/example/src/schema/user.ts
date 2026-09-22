import { orm } from '@mongorm/orm';

export const userSchema = orm.schema({
  name: orm.string(),
  age: orm.number(),
  role: orm.enum(['admin', 'member']),
  password: orm.string().hidden(),
  group: orm.objectId(),
  company: orm.objectId(),
  profile: orm
    .object({
      website: orm.string().optional(),
      location: orm.object({ city: orm.string() }),
    })
    .optional(),
});
