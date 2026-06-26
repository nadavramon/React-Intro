import { env } from './shared/config/env.ts';
import { logger } from './shared/utils/logger.ts';
import { connectDB, disconnectDB } from './shared/config/db.ts';
import { connectRedis, disconnectRedis } from './shared/config/redis.ts';
import { app } from './app.ts';

async function start() {
  await connectDB();
  await connectRedis();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
      logger.info(`${sig} received, shutting down`);
      await Promise.all([disconnectDB(), disconnectRedis()]);
      process.exit(0);
    });
  }
  app.listen(env.PORT, () => {
    logger.info(`Server running at http://localhost:${env.PORT}`);
  });
}

start().catch((err) => {
  logger.error(`Failed to start server: ${err}`);
  process.exit(1);
});
