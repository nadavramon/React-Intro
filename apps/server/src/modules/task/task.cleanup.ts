import { schedule, type ScheduledTask } from 'node-cron';
import { subDays } from 'date-fns';
import { TaskModel } from './task.schema.ts';
import * as taskCache from './task.cache.ts';
import { redis } from '../../shared/config/redis.ts';
import { logger } from '../../shared/utils/logger.ts';

const LOCK_KEY = 'cron:task-cleanup';
const LOCK_TTL_MS = 600_000; // ~10 min: outlives any plausible run, dies with a crashed holder
const RETENTION_DAYS = 7;
const CRON_EXPRESSION = '0 3 * * *'; // daily 03:00, server TZ (UTC in the Docker image)

// Best-effort distributed lock. Every instance fires its own 3am cron; SET NX PX
// lets exactly one win. Deliberately never released — if the winner finished in
// 2s and deleted the key, a sibling whose cron fires at 3:00:05 would acquire it
// and run again. Letting the TTL expire IS the design, not a leak.
async function acquireLock(): Promise<boolean> {
  try {
    const result = await redis.set(LOCK_KEY, String(process.pid), 'PX', LOCK_TTL_MS, 'NX');
    return result === 'OK';
  } catch (err) {
    // Redis down: run anyway. The job is idempotent (the second run's criteria
    // match nothing), so a duplicate run is wasted work, not corruption. A
    // non-idempotent job (billing, email) should skip here instead.
    logger.warn(`[cleanup] lock unavailable, running unlocked: ${err}`);
    return true;
  }
}

export async function cleanupOldTasks(): Promise<number> {
  if (!(await acquireLock())) {
    logger.info('[cleanup] lock held by another instance, skipping run');
    return 0;
  }

  // Store absolute timestamps, compute relative windows at query time.
  const cutoff = subDays(new Date(), RETENTION_DAYS);
  const criteria = {
    isCompleted: true,
    isDeleted: { $ne: true },
    completedAt: { $ne: null, $lt: cutoff },
  };

  // Distinct userIds first: the updateMany bypasses the service layer, so we
  // must invalidate each affected user's cache ourselves or the web app keeps
  // serving "deleted" todos until the cache TTL expires.
  const userIds = await TaskModel.distinct('userId', criteria);
  const { modifiedCount } = await TaskModel.updateMany(criteria, {
    isDeleted: true,
    deletedAt: new Date(),
  });
  for (const uid of userIds) await taskCache.invalidate(uid.toString());

  // Log zero-runs too, so the job is observably alive.
  logger.info(
    `[cleanup] soft-deleted ${modifiedCount} task(s) completed before ${cutoff.toISOString()}`,
  );
  return modifiedCount;
}

let job: ScheduledTask | null = null;

export function startTaskCleanup(): void {
  job = schedule(CRON_EXPRESSION, () => {
    cleanupOldTasks().catch((err) => logger.error(`[cleanup] run failed: ${err}`));
  });
  logger.info('[cleanup] daily task-cleanup cron scheduled (03:00 server time)');
}

export function stopTaskCleanup(): void {
  job?.stop();
  job = null;
}
