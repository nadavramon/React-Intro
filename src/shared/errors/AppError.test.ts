import { describe, it, expect } from 'vitest';
import { AppError, NotFoundError, UnauthorizedError, ValidationError } from './AppError.ts';

describe('AppError', () => {
  it('sets message and statusCode', () => {
    const err = new AppError('boom', 500);
    expect(err.message).toBe('boom');
    expect(err.statusCode).toBe(500);
    expect(err).toBeInstanceOf(Error);
  });

  it('NotFoundError defaults to 404', () => {
    const err = new NotFoundError();
    expect(err.statusCode).toBe(404);
    expect(err).toBeInstanceOf(AppError);
  });

  it('UnauthorizedError defaults to 401', () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });

  it('ValidationError carries custom message with 400', () => {
    const err = new ValidationError('bad input');
    expect(err.statusCode).toBe(400);
    expect(err.message).toBe('bad input');
  });
});
