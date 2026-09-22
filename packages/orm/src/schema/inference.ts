import type { z } from 'zod';

import type { SchemaShape } from './contracts.js';
import type { Schema } from './schema.js';

/** The parsed output type produced by a schema. */
export type Infer<T extends Schema<SchemaShape>> = z.infer<T['definition']>;
