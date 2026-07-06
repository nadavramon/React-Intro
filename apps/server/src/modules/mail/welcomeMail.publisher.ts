import { getPublishChannel, WELCOME_QUEUE } from '../../shared/config/rabbitmq.ts';
import { logger } from '../../shared/utils/logger.ts';
import type { WelcomeMessage } from './welcomeMail.service.ts';

// Best-effort by contract: this runs inside better-auth's create.after hook, and
// the user row is already committed — a throw here would fail the sign-up request.
// So we swallow every error (broker down, confirm timeout/nack) and only log.
export async function publishWelcomeEmail(msg: WelcomeMessage): Promise<void> {
  try {
    const ch = getPublishChannel();
    if (!ch) {
      logger.warn(`[welcome-mail] broker unavailable, welcome mail not queued for ${msg.userId}`);
      return;
    }
    ch.sendToQueue(WELCOME_QUEUE, Buffer.from(JSON.stringify(msg)), { persistent: true });
    await ch.waitForConfirms();
  } catch (err) {
    logger.error(`[welcome-mail] failed to publish for ${msg.userId}: ${(err as Error).message}`);
  }
}
