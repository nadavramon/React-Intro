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
  MONGODB_URI: requireEnv('MONGODB_URI'),
  GOOGLE_CLIENT_ID: requireEnv('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: requireEnv('GOOGLE_CLIENT_SECRET'),
  BETTER_AUTH_SECRET: requireEnv('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: requireEnv('BETTER_AUTH_URL'),
  PORT: process.env.PORT,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
  RABBITMQ_URL: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
  SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 1025),
  MAIL_FROM: process.env.MAIL_FROM ?? 'React_Intro <no-reply@react-intro.local>',
};
