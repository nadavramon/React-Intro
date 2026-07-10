import { env } from './shared/config/env.ts';
import { logger } from './shared/utils/logger.ts';
import { connectDB, disconnectDB } from './shared/config/db.ts';
import { connectRedis, disconnectRedis } from './shared/config/redis.ts';
import { connectRabbitMQ, disconnectRabbitMQ } from './shared/config/rabbitmq.ts';
import { startWelcomeConsumer } from './modules/mail/welcomeMail.consumer.ts';
import { startTaskCleanup, stopTaskCleanup } from './modules/task/task.cleanup.ts';
import { app } from './app.ts';

async function start() {
  await connectDB();
  connectRedis();
  startWelcomeConsumer(); // registers the re-subscribe callback (runs on connect)
  await connectRabbitMQ(); // resolves even if the broker is down (self-retries)
  startTaskCleanup();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
      logger.info(`${sig} received, shutting down`);
      stopTaskCleanup();
      await Promise.all([disconnectDB(), disconnectRedis(), disconnectRabbitMQ()]);
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
