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
  let session;
  try {
    session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
  } catch (err) {
    // Infra failure (Mongo down, adapter error) — let errorHandler 500 it, don't fake a 401
    next(err);
    return;
  }
  if (!session) {
    next(new UnauthorizedError('Not authenticated'));
    return;
  }
  req.user = {
    userId: session.user.id,
    email: session.user.email,
    role: (session.user.role ?? 'user') as UserRole,
  };
  next();
}
