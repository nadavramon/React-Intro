import jwt from 'jsonwebtoken';
import { env } from '../config/env.ts';
import { Request, Response, NextFunction } from 'express';
import { JwtPayload } from '../../modules/user/user.ts';
import { UnauthorizedError } from '../errors/AppError.ts';

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('Missing or invalid Authorization header');
    }

    const token = authHeader.split(' ')[1]!;
    const payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;

    req.user = payload;
    next();
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      next(err);
    } else {
      next(new UnauthorizedError('Invalid or expired token'));
    }
  }
}
