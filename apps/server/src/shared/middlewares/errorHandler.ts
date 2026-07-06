import { Request, Response, NextFunction } from 'express';
import { ApiError } from '@repo/shared';
import { AppError, ValidationError } from '../errors/AppError.ts';
import { logger } from '../utils/logger.ts';
import mongoose from 'mongoose';

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof mongoose.mongo.MongoServerError && err.code === 11000) {
    const field = Object.keys(err.keyValue ?? {})[0] ?? 'field';
    err = new ValidationError(`${field} already in use`);
  }

  const statusCode = err instanceof AppError ? err.statusCode : 500;
  const message = err instanceof AppError ? err.message : 'An unexpected error occurred';

  if (statusCode === 500) {
    logger.error(`${req.method} ${req.path} >> StatusCode: ${statusCode}\n${err.stack}`);
  } else {
    logger.error(`${req.method} ${req.path} >> StatusCode: ${statusCode} - ${message}`);
  }

  const payload: ApiError & { stack?: string | undefined } = { error: message };

  if (process.env.NODE_ENV === 'development') {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
}
