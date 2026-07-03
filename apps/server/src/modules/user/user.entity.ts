import type { UserRole } from '@repo/shared';

// Role is part of the shared API contract — re-exported so server modules keep
// importing it from the entity, but the single source of truth is @repo/shared.
export type { UserRole } from '@repo/shared';

export interface UserEntity {
  id: string;
  email: string;
  password: string;
  role: UserRole;
}
