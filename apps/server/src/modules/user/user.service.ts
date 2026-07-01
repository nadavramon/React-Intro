import bcrypt from 'bcrypt';
import { UserEntity, UserRole } from './user.entity.ts';
import { UserModel, UserDoc } from './user.schema.ts';
import { ValidationError, UnauthorizedError } from '../../shared/errors/AppError.ts';

const SALT_ROUNDS = 10;

function toUser(doc: UserDoc): UserEntity {
  return {
    id: doc._id.toString(),
    email: doc.email,
    password: doc.password,
    role: doc.role as UserRole,
  };
}

export async function createUser(
  email: string,
  password: string,
  role: UserRole = UserRole.USER,
): Promise<UserEntity> {
  const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
  const doc = await UserModel.create({ email, password: hashedPassword, role });
  return toUser(doc.toObject());
}

export async function verifyCredentials(email: string, password: string): Promise<UserEntity> {
  const doc = await UserModel.findOne({ email }).lean();
  if (!doc) throw new UnauthorizedError('Invalid email');

  const passwordMatch = await bcrypt.compare(password, doc.password);
  if (!passwordMatch) throw new UnauthorizedError('Invalid password');

  return toUser(doc);
}

export async function getById(id: string): Promise<UserEntity> {
  const doc = await UserModel.findById(id).lean();
  if (!doc) throw new UnauthorizedError('User not found');

  return toUser(doc);
}
