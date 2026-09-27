import { orm } from '@mongorm/orm';

export const USER_ROLES = ['owner', 'admin', 'member'] as const;
export const USER_STATUSES = ['active', 'invited', 'suspended'] as const;

export const userSchema = orm
  .schema({
    email: orm.email().toLowerCase(),
    passwordHash: orm.string().hidden(),
    firstName: orm.string().min(1).max(80),
    lastName: orm.string().min(1).max(80),
    role: orm.enum(USER_ROLES),
    status: orm.enum(USER_STATUSES),
    jobTitle: orm.string().max(120).optional(),
    phoneNumber: orm.string().optional().hidden(),
    profile: orm.object({
      avatarUrl: orm.url().nullable().optional(),
      timezone: orm.string(),
      locale: orm.string(),
      bio: orm.string().max(500).optional(),
    }),
    preferences: orm.object({
      emailNotifications: orm.boolean(),
      productUpdates: orm.boolean(),
    }),
  })
  .options({ timestamps: true, softdelete: true, hideManaged: true })
  .indexes([
    {
      fields: { email: 1 },
      options: {
        unique: true,
        name: 'user_email_active_unique',
        partialFilterExpression: { deletedAt: null },
      },
    },
    {
      fields: { role: 1, status: 1, lastName: 1, firstName: 1 },
      options: { name: 'user_directory' },
    },
  ]);
