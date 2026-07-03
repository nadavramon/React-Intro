import type { UserRole } from '@repo/shared';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export type { AuthTokens } from '@repo/shared';
