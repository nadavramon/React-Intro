import { z } from 'zod';

export const RegisterBodySchema = z.object({
  email: z.email({ error: 'Invalid email address' }),
  password: z
    .string({ error: 'Password must be a string' })
    .min(6, 'Password must be at least 6 characters'),
});
export type RegisterBodyDto = z.infer<typeof RegisterBodySchema>;

export { loginBodySchema as LoginBodySchema } from '@repo/shared';
export type { LoginBody as LoginBodyDto } from '@repo/shared';

export const RefreshBodySchema = z.object({
  refreshToken: z
    .string({ error: 'Refresh token is required' })
    .min(1, 'Refresh token is required'),
});
export type RefreshBodyDto = z.infer<typeof RefreshBodySchema>;
