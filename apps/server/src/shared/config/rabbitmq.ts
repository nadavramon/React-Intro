import amqp, { type ChannelModel, type ConfirmChannel } from 'amqplib';
import { env } from './env.ts';
import { logger } from '../utils/logger.ts';

export const WELCOME_QUEUE = 'welcome.email';
export const WELCOME_DLX = 'welcome.email.dlx';
export const WELCOME_DLQ = 'welcome.email.dlq';

let connection: ChannelModel | null = null;
let publishChannel: ConfirmChannel | null = null;
let stopped = false;
const readyCallbacks: Array<() => Promise<void>> = [];

/** Consumers register a setup fn; it runs on first connect and on every reconnect. */
export function onRabbitReady(cb: () => Promise<void>): void {
  readyCallbacks.push(cb);
}

export function getConnection(): ChannelModel | null {
  return connection;
}
export function getPublishChannel(): ConfirmChannel | null {
  return publishChannel;
}

async function assertTopology(ch: ConfirmChannel): Promise<void> {
  await ch.assertExchange(WELCOME_DLX, 'fanout', { durable: true });
  await ch.assertQueue(WELCOME_DLQ, { durable: true });
  await ch.bindQueue(WELCOME_DLQ, WELCOME_DLX, '');
  // Main queue dead-letters (nack requeue=false / rejects) to the fanout DLX.
  await ch.assertQueue(WELCOME_QUEUE, { durable: true, deadLetterExchange: WELCOME_DLX });
}

function scheduleReconnect(): void {
  if (stopped) return;
  connection = null;
  publishChannel = null;
  setTimeout(() => {
    connectRabbitMQ().catch(() => {
      /* connectRabbitMQ reschedules itself on failure */
    });
  }, 3000);
}

export async function connectRabbitMQ(): Promise<void> {
  stopped = false;
  try {
    const conn = await amqp.connect(env.RABBITMQ_URL);
    conn.on('error', (err) => logger.warn(`[queue] connection error: ${err.message}`));
    conn.on('close', () => {
      if (!stopped) {
        logger.warn('[queue] connection closed, reconnecting…');
        scheduleReconnect();
      }
    });
    const ch = await conn.createConfirmChannel();
    await assertTopology(ch);
    connection = conn;
    publishChannel = ch;
    logger.info('Connected to RabbitMQ');
    // Run (re)subscribe callbacks with per-callback isolation: a consumer that
    // fails to set up must NOT reschedule a reconnect on this healthy connection
    // (that would orphan it and loop). Genuine connect / confirm-channel / topology
    // failures happen above this line and correctly fall to the outer catch.
    for (const cb of readyCallbacks) {
      try {
        await cb(); // (re)start consumers
      } catch (err) {
        logger.error(`[queue] ready callback failed: ${(err as Error).message}`);
      }
    }
  } catch (err) {
    logger.warn(`[queue] RabbitMQ unavailable, retrying in 3s: ${(err as Error).message}`);
    scheduleReconnect();
  }
}

export async function disconnectRabbitMQ(): Promise<void> {
  stopped = true;
  try {
    await connection?.close(); // closes child channels too
  } catch {
    /* ignore */
  }
  connection = null;
  publishChannel = null;
  logger.info('Disconnected from RabbitMQ');
}
