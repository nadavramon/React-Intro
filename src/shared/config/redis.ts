import { Redis } from 'ioredis';
import { env } from './env.ts';
import { logger } from '../utils/logger.ts';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

redis.on('error', (err) => logger.warn(`[cache] redis error: ${err.message}`));

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    logger.info('Connected to Redis');
  } catch (err) {
    logger.warn(`[cache] Redis unavailable, running without cache: ${err}`);
  }
}

export async function disconnectRedis(): Promise<void> {
  redis.disconnect();
  logger.info('Disconnected from Redis');
}
