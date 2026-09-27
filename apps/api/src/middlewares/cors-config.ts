import base from 'cors';

import { env } from '@/config/env';

export const corsConfig = base({
  origin: env.CORS_ORIGINS,
  credentials: true,
  maxAge: 600,
});
