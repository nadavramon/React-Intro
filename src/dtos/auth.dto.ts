import { z } from 'zod';

export const RegisterBodySchema = z.object({
  email: z.email({ error: 'Invalid email address' }),
  password: z.string({ error: 'Password must be a string' }).min(6, 'Password must be at least 6 characters'),
});
export type RegisterBodyDto = z.infer<typeof RegisterBodySchema>;

export const LoginBodySchema = z.object({
  email: z.email({ error: 'Invalid email address' }),
  password: z.string({ error: 'Password must be a string' }).min(1, 'Password is required'),
});
export type LoginBodyDto = z.infer<typeof LoginBodySchema>;
