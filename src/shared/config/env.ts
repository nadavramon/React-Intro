import { logger } from '../utils/logger.ts';

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    logger.error(`${name} is not defined`);
    process.exit(1);
  }
  return value;
}

export const env = {
  JWT_SECRET: requireEnv('JWT_SECRET'),
  REFRESH_TOKEN_SECRET: requireEnv('REFRESH_TOKEN_SECRET'),
  PORT: process.env.PORT,
};
