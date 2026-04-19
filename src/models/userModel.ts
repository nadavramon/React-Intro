import { UserEntity } from '../types/user.ts';

const userStore: UserEntity[] = [];

export function findByEmail(email: string): UserEntity | undefined {
  return userStore.find((user) => user.email === email);
}

export function findById(id: string): UserEntity | undefined {
  return userStore.find((user) => user.id === id);
}

export function create(user: UserEntity): UserEntity {
  userStore.push(user);
  return user;
}
