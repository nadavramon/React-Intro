import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService.ts';
import { RegisterBodySchema, LoginBodySchema, RefreshBodySchema } from '../dtos/auth.dto.ts';
import { ValidationError } from '../errors/AppError.ts';

export async function register(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = RegisterBodySchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]!.message);
    }

    await authService.register(result.data);
    res.status(201).json({ message: 'User registered successfully' });
  } catch (err) {
    next(err);
  }
}

export async function login(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = LoginBodySchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]!.message);
    }

    const { accessToken, refreshToken } = await authService.login(result.data);
    res.status(200).json({ accessToken, refreshToken });
  } catch (err) {
    next(err);
  }
}

export async function refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = RefreshBodySchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.issues[0]!.message);

    const { accessToken } = await authService.refresh(result.data);
    res.status(200).json({ accessToken });
  } catch (err) {
    next(err);
  }
}

export async function logout(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = RefreshBodySchema.safeParse(req.body);
    if (!result.success) throw new ValidationError(result.error.issues[0]!.message);

    await authService.logout(result.data);
    res.status(204).send();
  } catch (err) {
    next(err);
  }
}
