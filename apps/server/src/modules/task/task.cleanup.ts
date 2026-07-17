import { schedule, type ScheduledTask } from 'node-cron';
import { subDays } from 'date-fns';
import { TaskModel } from './task.schema.ts';
import * as taskCache from './task.cache.ts';
import { redis } from '../../shared/config/redis.ts';
import { logger } from '../../shared/utils/logger.ts';

const LOCK_KEY = 'cron:task-cleanup';
const LOCK_TTL_MS = 600_000;
const RETENTION_DAYS = 7;
const CRON_EXPRESSION = '0 3 * * *';

async function acquireLock(): Promise<boolean> {
  try {
    const result = await redis.set(LOCK_KEY, String(process.pid), 'PX', LOCK_TTL_MS, 'NX');
    return result === 'OK';
  } catch (err) {
    logger.warn(`[cleanup] lock unavailable, running unlocked: ${err}`);
    return true;
  }
}

export async function cleanupOldTasks(): Promise<number> {
  if (!(await acquireLock())) {
    logger.info('[cleanup] lock held by another instance, skipping run');
    return 0;
  }

  const cutoff = subDays(new Date(), RETENTION_DAYS);
  const criteria = {
    isCompleted: true,
    isDeleted: { $ne: true },
    completedAt: { $ne: null, $lt: cutoff },
  };

  const userIds = await TaskModel.distinct('userId', criteria);
  const { modifiedCount } = await TaskModel.updateMany(criteria, {
    isDeleted: true,
    deletedAt: new Date(),
  });
  for (const uid of userIds) await taskCache.invalidate(uid.toString());

  logger.info(
    `[cleanup] soft-deleted ${modifiedCount} task(s) completed before ${cutoff.toISOString()}`,
  );
  return modifiedCount;
}

let job: ScheduledTask | null = null;

export function startTaskCleanup(): void {
  job = schedule(
    CRON_EXPRESSION,
    () => cleanupOldTasks().catch((err) => logger.error(`[cleanup] run failed: ${err}`)),
    { noOverlap: true },
  );
  logger.info('[cleanup] daily task-cleanup cron scheduled (03:00 server time)');
}

export async function stopTaskCleanup(): Promise<void> {
  await job?.stop();
  job = null;
}
