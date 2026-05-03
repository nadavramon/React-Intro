import jwt from 'jsonwebtoken';
import { env } from '../../shared/config/env.ts';
import { RegisterBodyDto, LoginBodyDto, RefreshBodyDto } from './auth.dto.ts';
import { UserEntity } from '../user/user.entity.ts';
import { AuthTokens, JwtPayload } from './auth.types.ts';
import { UnauthorizedError } from '../../shared/errors/AppError.ts';
import * as userService from '../user/user.service.ts';
import { RefreshTokenModel } from './refresh-token.schema.ts';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function register(dto: RegisterBodyDto): Promise<AuthTokens> {
  const user = await userService.createUser(dto.email, dto.password);
  return generateTokens(user);
}

export async function login(dto: LoginBodyDto): Promise<AuthTokens> {
  const user = await userService.verifyCredentials(dto.email, dto.password);
  return generateTokens(user);
}

export async function refresh(dto: RefreshBodyDto): Promise<{ accessToken: string }> {
  let refreshPayload: { userId: string };
  try {
    refreshPayload = jwt.verify(dto.refreshToken, env.REFRESH_TOKEN_SECRET) as { userId: string };
  } catch {
    throw new UnauthorizedError('Invalid refresh token');
  }
  const stored = await RefreshTokenModel.findOne({ token: dto.refreshToken }).lean();

  if (!stored || stored.userId.toString() !== refreshPayload.userId)
    throw new UnauthorizedError('Invalid refresh token');

  const user = await userService.getById(refreshPayload.userId);

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return { accessToken: jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' }) };
}

export async function logout(dto: RefreshBodyDto): Promise<void> {
  await RefreshTokenModel.deleteOne({ token: dto.refreshToken });
}

async function generateTokens(user: UserEntity): Promise<AuthTokens> {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id }, env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });

  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);
  await RefreshTokenModel.create({ token: refreshToken, userId: user.id, expiresAt });

  return { accessToken, refreshToken };
}
