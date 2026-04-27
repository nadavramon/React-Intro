import { JwtPayload } from '../../modules/auth/auth.ts';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
