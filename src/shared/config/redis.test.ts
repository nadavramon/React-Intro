import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock ioredis with an EventEmitter so we can drive 'ready'/'error' transitions
// without a live Redis. The constructor args (url, options) are ignored. The factory
// is hoisted above imports, so `node:events` is pulled in here, not at the top.
vi.mock('ioredis', async () => {
  const { EventEmitter } = await import('node:events');
  class FakeRedis extends EventEmitter {
    status = 'connecting';
    connect = vi.fn();
    disconnect = vi.fn();
  }
  return { Redis: FakeRedis };
});

vi.mock('../utils/logger.ts', () => ({
  logger: { info: vi.fn(), warn: vi.fn() },
}));

import { redis } from './redis.ts';
import { logger } from './../utils/logger.ts';

beforeEach(() => {
  // A 'ready' resets the module's internal outage flag to a known state; clearing
  // the mocks afterward keeps that reset from counting toward a test's assertions.
  redis.emit('ready');
  vi.clearAllMocks();
});

describe('redis connection-state logging', () => {
  it('logs "Redis unavailable" once per outage, not on every retry', () => {
    redis.emit('error', new Error('down'));
    redis.emit('error', new Error('still down'));
    redis.emit('error', new Error('still down'));
    expect(logger.warn).toHaveBeenCalledTimes(1);
    expect(logger.warn).toHaveBeenCalledWith(
      '[cache] Redis unavailable, running without cache: down',
    );
  });

  it('logs reconnection when Redis comes back after an outage', () => {
    redis.emit('error', new Error('down')); // open an outage
    redis.emit('ready'); // recovery
    expect(logger.info).toHaveBeenCalledWith('[cache] Redis reconnected');
  });

  it('re-arms after recovery: a new outage logs again', () => {
    redis.emit('error', new Error('down'));
    redis.emit('ready');
    redis.emit('error', new Error('down again'));
    expect(logger.warn).toHaveBeenCalledTimes(2);
  });
});
