import { AuthUser } from '../middlewares/authenticate.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
export {};
