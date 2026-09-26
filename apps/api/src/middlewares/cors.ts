import base, { type CorsOptions } from 'cors';

import { env } from '@/config/env';

const corsOptions: CorsOptions = {
  origin: env.CORS_ORIGINS,
  credentials: true,
  maxAge: 600,
};

export const cors = base(corsOptions);
