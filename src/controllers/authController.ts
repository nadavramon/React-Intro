import { Request, Response, NextFunction } from 'express';
import * as authService from '../services/authService.ts';
import { RegisterBodySchema, LoginBodySchema } from '../dtos/auth.dto.ts';
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
    

    const token = await authService.login(result.data);
    res.status(200).json({ token });
  } catch (err) {
    next(err);
  }
}
