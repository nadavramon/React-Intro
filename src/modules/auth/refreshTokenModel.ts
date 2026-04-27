import { RefreshTokenModel, RefreshTokenDoc } from './refreshTokenSchema.ts';
import { RefreshTokenEntity } from './refreshToken.ts';

function toRefreshToken(doc: RefreshTokenDoc): RefreshTokenEntity {
  return {
    token: doc.token,
    userId: doc.userId.toString(),
    expiresAt: doc.expiresAt,
  };
}

export async function save(token: string, userId: string, expiresAt: Date): Promise<void> {
  await RefreshTokenModel.create({ token, userId, expiresAt });
}

export async function findByToken(token: string): Promise<RefreshTokenEntity | null> {
  const doc = await RefreshTokenModel.findOne({ token }).lean();
  return doc ? toRefreshToken(doc) : null;
}

export async function remove(token: string): Promise<void> {
  await RefreshTokenModel.deleteOne({ token });
}
