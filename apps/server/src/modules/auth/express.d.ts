import { AuthUser } from './authenticate.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
export {};
