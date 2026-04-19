import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import * as userModel from '../models/userModel.ts';
import { RegisterBodyDto, LoginBodyDto } from '../dtos/auth.dto.ts';
import { JwtPayload } from '../types/user.ts';
import { ValidationError, UnauthorizedError } from '../errors/AppError.ts';

const SALT_ROUNDS = 10;
const JWT_SECRET = process.env.JWT_SECRET!;

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

export async function login(dto: LoginBodyDto): Promise<string> {
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

  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}
