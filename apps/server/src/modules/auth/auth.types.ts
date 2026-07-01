import { UserRole } from '../user/user.entity.ts';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export type { AuthTokens } from '@repo/shared';
