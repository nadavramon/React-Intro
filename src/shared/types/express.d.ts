import { JwtPayload } from '../../modules/auth/auth.types.ts';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
