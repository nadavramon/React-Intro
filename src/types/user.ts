import { Request } from 'express';

export type UserRole = 'admin' | 'user';

export interface UserEntity {
  id: string;
  email: string;
  password: string;
  role: UserRole;
}

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
