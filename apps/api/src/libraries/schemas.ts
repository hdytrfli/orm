import { ObjectId } from '@mongorm/orm';
import { z } from 'zod';

export const objectIdSchema = z
  .string()
  .length(24)
  .refine((value) => ObjectId.isValid(value), 'Invalid ObjectId')
  .transform((id) => new ObjectId(id));

export const paramsSchema = z.object({
  id: objectIdSchema,
});

export const paginationSchema = z.object({
  skip: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
