import { UserEntity, UserRole } from './user.ts';
import { UserModel, UserDoc } from './userSchema.ts';

function toUser(doc: UserDoc): UserEntity {
  return {
    id: doc._id.toString(),
    email: doc.email,
    password: doc.password,
    role: doc.role as UserRole,
  };
}

export async function findByEmail(email: string): Promise<UserEntity | null> {
  const doc = await UserModel.findOne({ email }).lean();
  return doc ? toUser(doc) : null;
}

export async function findById(id: string): Promise<UserEntity | null> {
  const doc = await UserModel.findById(id).lean();
  return doc ? toUser(doc) : null;
}

export async function create(input: Omit<UserEntity, 'id'>): Promise<UserEntity> {
  const doc = await UserModel.create(input);
  return toUser(doc.toObject());
}
