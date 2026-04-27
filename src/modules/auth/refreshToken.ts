export interface RefreshTokenEntity {
  token: string;
  userId: string;
  expiresAt: Date;
}
