import { z } from 'zod';
import { ValidationError } from '../errors/AppError.ts';

export function validate<T>(schema: z.ZodType<T>, input: unknown): T {
  const result = schema.safeParse(input);

  if (!result.success) throw new ValidationError(result.error.issues[0]!.message);

  return result.data;
}
