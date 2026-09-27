import { ObjectId } from 'mongodb';
import { z } from 'zod';

import { withHidden } from './hidden.js';

/** Create a hidden-capable MongoDB ObjectId schema. */
export const objectId = () => withHidden(z.instanceof(ObjectId));
