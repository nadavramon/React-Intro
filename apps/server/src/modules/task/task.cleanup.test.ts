import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./task.schema.ts', () => ({
  TaskModel: { distinct: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('./task.cache.ts', () => ({ invalidate: vi.fn() }));
vi.mock('../../shared/config/redis.ts', () => ({ redis: { set: vi.fn() } }));
vi.mock('node-cron', () => ({ schedule: vi.fn(() => ({ stop: vi.fn() })) }));

import { TaskModel } from './task.schema.ts';
import * as taskCache from './task.cache.ts';
import { redis } from '../../shared/config/redis.ts';
import { schedule } from 'node-cron';
import { cleanupOldTasks, startTaskCleanup, stopTaskCleanup } from './task.cleanup.ts';

const NOW = new Date('2026-07-10T03:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  vi.mocked(redis.set).mockResolvedValue('OK');
  vi.mocked(TaskModel.distinct).mockResolvedValue([]);
  vi.mocked(TaskModel.updateMany).mockResolvedValue({ modifiedCount: 0 } as never);
});
afterEach(() => vi.useRealTimers());

describe('cleanupOldTasks', () => {
  it('soft-deletes tasks completed before the 7-day cutoff', async () => {
    vi.mocked(TaskModel.updateMany).mockResolvedValue({ modifiedCount: 2 } as never);

    const count = await cleanupOldTasks();

    const cutoff = new Date('2026-07-03T03:00:00Z');
    const expectedCriteria = {
      isCompleted: true,
      isDeleted: { $ne: true },
      completedAt: { $ne: null, $lt: cutoff },
    };
    expect(TaskModel.updateMany).toHaveBeenCalledWith(
      expectedCriteria,
      { isDeleted: true, deletedAt: expect.any(Date) },
      { timestamps: false },
    );
    expect(count).toBe(2);
  });

  it('invalidates the cache of every affected user', async () => {
    vi.mocked(TaskModel.distinct).mockResolvedValue([
      { toString: () => 'u1' },
      { toString: () => 'u2' },
    ] as never);

    await cleanupOldTasks();

    expect(taskCache.invalidate).toHaveBeenCalledWith('u1');
    expect(taskCache.invalidate).toHaveBeenCalledWith('u2');
  });

  it('acquires the lock with SET NX PX and skips when another instance holds it', async () => {
    vi.mocked(redis.set).mockResolvedValue(null);

    const count = await cleanupOldTasks();

    expect(redis.set).toHaveBeenCalledWith(
      'cron:task-cleanup',
      expect.any(String),
      'PX',
      600_000,
      'NX',
    );
    expect(TaskModel.updateMany).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });

  it('runs anyway when Redis is down (idempotent job, best-effort lock)', async () => {
    vi.mocked(redis.set).mockRejectedValue(new Error('connection refused'));

    await cleanupOldTasks();

    expect(TaskModel.updateMany).toHaveBeenCalled();
  });
});

describe('cron wiring', () => {
  it('schedules the daily job at 03:00 with no-overlap and stop() stops it', async () => {
    startTaskCleanup();
    expect(schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function), { noOverlap: true });

    const task = vi.mocked(schedule).mock.results[0]!.value;
    await stopTaskCleanup();
    expect(task.stop).toHaveBeenCalled();
  });
});
