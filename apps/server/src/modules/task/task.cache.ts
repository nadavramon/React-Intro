import { redis } from '../../shared/config/redis.ts';
import { logger } from '../../shared/utils/logger.ts';
import { Task } from '@repo/shared';

const TTL_SECONDS = 60;

function keyFor(userId: string): string {
  return `tasks:user:${userId}`;
}

export async function read(userId: string): Promise<Task[] | null> {
  try {
    const cached = await redis.get(keyFor(userId));
    if (cached === null) {
      logger.info(`[cache] MISS tasks user=${userId}`);
      return null;
    }
    logger.info(`[cache] HIT tasks user=${userId}`);
    return JSON.parse(cached) as Task[];
  } catch (err) {
    logger.warn(`[cache] read failed user=${userId}: ${err}`);
    return null;
  }
}

export async function write(userId: string, tasks: Task[]): Promise<void> {
  try {
    await redis.set(keyFor(userId), JSON.stringify(tasks), 'EX', TTL_SECONDS);
  } catch (err) {
    logger.warn(`[cache] write failed user=${userId}: ${err}`);
  }
}

export async function invalidate(userId: string): Promise<void> {
  try {
    await redis.del(keyFor(userId));
    logger.info(`[cache] INVALIDATE tasks user=${userId}`);
  } catch (err) {
    logger.warn(`[cache] invalidate failed user=${userId}: ${err}`);
  }
}
