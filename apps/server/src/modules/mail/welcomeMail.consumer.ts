import type { Channel, ConsumeMessage } from 'amqplib';
import { getConnection, onRabbitReady, WELCOME_QUEUE } from '../../shared/config/rabbitmq.ts';
import { logger } from '../../shared/utils/logger.ts';
import { processWelcomeMessage } from './welcomeMail.service.ts';

// Exported for unit testing the result→AMQP mapping.
export async function handleDelivery(channel: Channel, msg: ConsumeMessage | null): Promise<void> {
  if (!msg) return; // consumer cancelled by the broker
  const result = await processWelcomeMessage(msg.content.toString());
  if (result.action === 'ack') channel.ack(msg);
  else if (result.action === 'retry')
    channel.nack(msg, false, true); // requeue
  else channel.nack(msg, false, false); // dead-letter to the DLQ
}

export function startWelcomeConsumer(): void {
  onRabbitReady(async () => {
    const conn = getConnection();
    if (!conn) return;
    const channel = await conn.createChannel();
    await channel.prefetch(1); // one unacked message at a time — one SMTP send in flight
    await channel.consume(WELCOME_QUEUE, (msg) => {
      handleDelivery(channel, msg).catch((err) =>
        logger.error(`[welcome-mail] consumer error: ${(err as Error).message}`),
      );
    });
    logger.info('[welcome-mail] consumer subscribed to welcome.email');
  });
}
