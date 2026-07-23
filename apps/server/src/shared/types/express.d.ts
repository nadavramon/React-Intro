import { AuthUser } from '../../modules/auth/authenticate.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
export {};
