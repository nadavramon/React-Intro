import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.ts';

export function httpLogger(req: Request, _res: Response, next: NextFunction): void {
  logger.info(`Incoming request: ${req.method} ${req.path}`);
  next();
}
