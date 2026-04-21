export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

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

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}
