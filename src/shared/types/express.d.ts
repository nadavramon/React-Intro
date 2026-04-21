import { JwtPayload } from '../../modules/user/user.ts';

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export {};
