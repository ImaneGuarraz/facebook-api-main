import { z } from 'zod';

import { email, name, password } from './auth.js';

export const updateMeSchema = z
  .object({
    email: email.optional(),
    password: password.optional(),
    firstName: name.optional(),
    lastName: name.optional(),
  })
  .strict()
  .refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field is required',
  });
