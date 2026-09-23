import { orm } from '@mongorm/orm';

export const userSchema = orm
  .schema({
    name: orm.string(),
    age: orm.number(),
    role: orm.enum(['admin', 'member']),
    password: orm.string().hidden(),
    group: orm.objectId(),
    company: orm.objectId(),
    profile: orm.object({
      email: orm.string().hidden(),
      website: orm.url(),
      location: orm.object({
        city: orm.string(),
        country: orm.string().toUpperCase(),
      }),
    }),
  })
  .options({
    timestamps: true,
    softdelete: true,
  });
