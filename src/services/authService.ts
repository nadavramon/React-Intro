import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import * as userModel from '../models/userModel.ts';
import { RegisterBodyDto, LoginBodyDto, RefreshBodyDto } from '../dtos/auth.dto.ts';
import { AuthTokens, JwtPayload } from '../types/user.ts';
import { ValidationError, UnauthorizedError } from '../errors/AppError.ts';
import * as refreshTokenModel from '../models/refreshTokenModel.ts';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET!;
const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET!;

export async function register(dto: RegisterBodyDto): Promise<void> {
  const existing = userModel.findByEmail(dto.email);
  if (existing) {
    throw new ValidationError('Email already in use');
  }

  const hashedPassword = await bcrypt.hash(dto.password, SALT_ROUNDS);

  userModel.create({
    id: randomUUID(),
    email: dto.email,
    password: hashedPassword,
    role: 'user',
  });
}

export async function login(dto: LoginBodyDto): Promise<AuthTokens> {
  const user = userModel.findByEmail(dto.email);
  if (!user) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const passwordMatch = await bcrypt.compare(dto.password, user.password);
  if (!passwordMatch) {
    throw new UnauthorizedError('Invalid email or password');
  }

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
  const refreshToken = jwt.sign({ userId: user.id }, REFRESH_TOKEN_SECRET, { expiresIn: '7d' });
  refreshTokenModel.save(refreshToken, user.id);

  return { accessToken, refreshToken };
}

export async function refresh(dto: RefreshBodyDto): Promise<{ accessToken: string }> {
  const refreshPayload = jwt.verify(dto.refreshToken, REFRESH_TOKEN_SECRET) as { userId: string };

  const token = refreshTokenModel.findByToken(dto.refreshToken);

  if (!token) throw new UnauthorizedError('Invalid refresh token');

  const user = userModel.findById(refreshPayload.userId);

  if (!user) throw new UnauthorizedError('User not found');

  const payload: JwtPayload = {
    userId: user.id,
    email: user.email,
    role: user.role,
  };

  return { accessToken: jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' }) };
}

export async function logout(dto: RefreshBodyDto): Promise<void> {
  refreshTokenModel.remove(dto.refreshToken);
}
