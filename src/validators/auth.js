import { z } from 'zod';

export const email = z.string().trim().toLowerCase().pipe(z.email());
export const name = z.string().trim().min(1).max(80);
export const password = z.string().min(8).max(72);

export const registerSchema = z
  .object({
    email,
    password,
    firstName: name,
    lastName: name,
  })
  .strict();

export const loginSchema = z
  .object({
    email,
    password,
  })
  .strict();
