import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../shared/config/redis.ts', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

import { redis } from '../../shared/config/redis.ts';
import { read, write, invalidate } from './task.cache.ts';

const userId = 'user-1';
const key = 'tasks:user:user-1';
const tasks = [{ id: 't1', userId, title: 'A', isCompleted: false }];

beforeEach(() => vi.clearAllMocks());

describe('task.cache read', () => {
  it('returns parsed tasks on hit', async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(tasks));
    expect(await read(userId)).toEqual(tasks);
    expect(redis.get).toHaveBeenCalledWith(key);
  });

  it('returns null on miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    expect(await read(userId)).toBeNull();
  });

  it('fails open to null when redis throws', async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error('down'));
    expect(await read(userId)).toBeNull();
  });
});

describe('task.cache write', () => {
  it('sets the key with a 60s TTL', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK');
    await write(userId, tasks);
    expect(redis.set).toHaveBeenCalledWith(key, JSON.stringify(tasks), 'EX', 60);
  });

  it('swallows redis errors', async () => {
    vi.mocked(redis.set).mockRejectedValue(new Error('down'));
    await expect(write(userId, tasks)).resolves.toBeUndefined();
  });
});

describe('task.cache invalidate', () => {
  it('deletes the user key', async () => {
    vi.mocked(redis.del).mockResolvedValue(1);
    await invalidate(userId);
    expect(redis.del).toHaveBeenCalledWith(key);
  });

  it('swallows redis errors', async () => {
    vi.mocked(redis.del).mockRejectedValue(new Error('down'));
    await expect(invalidate(userId)).resolves.toBeUndefined();
  });
});
