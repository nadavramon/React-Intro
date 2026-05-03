export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
}

export interface UserEntity {
  id: string;
  email: string;
  password: string;
  role: UserRole;
}
