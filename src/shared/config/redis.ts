import { Redis } from 'ioredis';
import { env } from './env.ts';
import { logger } from '../utils/logger.ts';

// No `lazyConnect`: ioredis connects on construction and auto-reconnects (default
// retryStrategy). This means a Redis that is down at boot — not just one that blips
// mid-run — heals on its own once Redis becomes reachable. `enableOfflineQueue: false`
// + `maxRetriesPerRequest: 1` keep commands failing fast while disconnected, so cache
// calls fail open to Mongo instead of hanging.
export const redis = new Redis(env.REDIS_URL, {
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

// Log on connection-state transitions only. ioredis emits `error` on every failed
// reconnect attempt (~1/sec while Redis is down); logging each one floods the log,
// so we log the first failure of an outage and the eventual recovery, nothing between.
let unavailableLogged = false;

redis.on('ready', () => {
  logger.info(unavailableLogged ? '[cache] Redis reconnected' : 'Connected to Redis');
  unavailableLogged = false;
});

redis.on('error', (err) => {
  if (!unavailableLogged) {
    logger.warn(`[cache] Redis unavailable, running without cache: ${err.message}`);
    unavailableLogged = true;
  }
});

// ioredis already started connecting on construction and keeps retrying on its own;
// there is nothing to await here. Connection state is reported by the handlers above.
// Kept as a named export so boot wiring in index.ts stays symmetric with connectDB.
export function connectRedis(): void {}

export async function disconnectRedis(): Promise<void> {
  redis.disconnect();
  logger.info('Disconnected from Redis');
}
