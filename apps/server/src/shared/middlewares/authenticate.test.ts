import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/auth.ts', () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from '../config/auth.ts';
import { authenticate } from './authenticate.ts';
import { UnauthorizedError } from '../errors/AppError.ts';
import type { Request, Response, NextFunction } from 'express';

const getSession = vi.mocked(auth.api.getSession);
const makeReq = () => ({ headers: { cookie: 'x' } }) as unknown as Request;
const res = {} as Response;

beforeEach(() => vi.clearAllMocks());

describe('authenticate (better-auth session)', () => {
  it('sets req.user from the session and calls next() with no error', async () => {
    getSession.mockResolvedValue({
      session: { id: 's1' },
      user: { id: 'u1', email: 'a@b.c', role: 'user' },
    } as never);
    const req = makeReq();
    const next = vi.fn() as NextFunction;
    await authenticate(req, res, next);
    expect(req.user).toEqual({ userId: 'u1', email: 'a@b.c', role: 'user' });
    expect(next).toHaveBeenCalledWith();
  });

  it('401s when there is no session', async () => {
    getSession.mockResolvedValue(null as never);
    const next = vi.fn() as NextFunction;
    await authenticate(makeReq(), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('passes infrastructure errors through untouched (5xx path, not 401)', async () => {
    const boom = new Error('boom');
    getSession.mockRejectedValue(boom);
    const next = vi.fn() as NextFunction;
    await authenticate(makeReq(), res, next);
    expect(next).toHaveBeenCalledWith(boom);
    expect(next).not.toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
