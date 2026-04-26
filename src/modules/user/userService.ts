import bcrypt from 'bcrypt';
import * as userModel from './userModel.ts';
import { UserEntity, UserRole } from './user.ts';
import { ValidationError, UnauthorizedError } from '../../shared/errors/AppError.ts';

const SALT_ROUNDS = 10;

export async function createUser(
  email: string,
  password: string,
  role: UserRole = UserRole.USER,
): Promise<UserEntity> {
  const existing = await userModel.findByEmail(email);

  if (existing) throw new ValidationError('Email already in use');

  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

  return userModel.create({
    email,
    password: hashedPassword,
    role,
  });
}

export async function verifyCredentials(email: string, password: string): Promise<UserEntity> {
  const user = await userModel.findByEmail(email);
  if (!user) throw new UnauthorizedError('Invalid email');

  const passwordMatch = await bcrypt.compare(password, user.password);
  if (!passwordMatch) throw new UnauthorizedError('Invalid password');

  return user;
}

export async function getById(id: string): Promise<UserEntity> {
  const user = await userModel.findById(id);
  if (!user) throw new UnauthorizedError('User not found');

  return user;
}
