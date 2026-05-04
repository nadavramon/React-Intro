import { Request, Response } from 'express';
import * as authService from './auth.service.ts';
import { RegisterBodySchema, LoginBodySchema, RefreshBodySchema } from './auth.dto.ts';
import { validate } from '../../shared/utils/validate.ts';

export async function register(req: Request, res: Response): Promise<void> {
  const body = validate(RegisterBodySchema, req.body);

  const { accessToken, refreshToken } = await authService.register(body);
  res.status(201).json({ message: 'User registered successfully', accessToken, refreshToken });
}

export async function login(req: Request, res: Response): Promise<void> {
  const body = validate(LoginBodySchema, req.body);

  const { accessToken, refreshToken } = await authService.login(body);
  res.status(200).json({ accessToken, refreshToken });
}

export async function refresh(req: Request, res: Response): Promise<void> {
  const body = validate(RefreshBodySchema, req.body);

  const { accessToken } = await authService.refresh(body);
  res.status(200).json({ accessToken });
}

export async function logout(req: Request, res: Response): Promise<void> {
  const body = validate(RefreshBodySchema, req.body);

  await authService.logout(body);
  res.status(204).send();
}
