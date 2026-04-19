import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.ts';
import { logger } from '../utils/logger.ts';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'An unexpected error occurred';

  if (statusCode === 500) {
    logger.error(`${req.method} ${req.path} >> StatusCode: ${statusCode}\n${err.stack}`);
  } else {
    logger.error(`${req.method} ${req.path} >> StatusCode: ${statusCode} - ${message}`);
  }

  const payload: Record<string, unknown> = {
    error: message,
  };

  if (process.env.NODE_ENV === 'development') {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}
