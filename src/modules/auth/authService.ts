import jwt from 'jsonwebtoken';
import { env } from '../../shared/config/env.ts';
import { RegisterBodyDto, LoginBodyDto, RefreshBodyDto } from './auth.dto.ts';
import { AuthTokens, JwtPayload, UserEntity } from '../user/user.ts';
import { UnauthorizedError } from '../../shared/errors/AppError.ts';
import * as userService from '../user/userService.ts';
import * as refreshTokenModel from './refreshTokenModel.ts';

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
  const ownerId = refreshTokenModel.findByToken(dto.refreshToken);

  if (!ownerId || ownerId !== refreshPayload.userId)
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
  refreshTokenModel.remove(dto.refreshToken);
}

function generateTokens(user: UserEntity): AuthTokens {
  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id }, env.REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  refreshTokenModel.save(refreshToken, user.id);

  return { accessToken, refreshToken };
}
