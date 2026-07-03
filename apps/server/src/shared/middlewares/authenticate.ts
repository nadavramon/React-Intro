import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { UserRole } from '@repo/shared';
import { auth } from '../config/auth.ts';
import { UnauthorizedError } from '../errors/AppError.ts';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedError('Not authenticated');
    req.user = {
      userId: session.user.id,
      email: session.user.email,
      role: (session.user.role ?? 'user') as UserRole,
    };
    next();
  } catch (err) {
    next(err instanceof UnauthorizedError ? err : new UnauthorizedError('Invalid session'));
  }
}
