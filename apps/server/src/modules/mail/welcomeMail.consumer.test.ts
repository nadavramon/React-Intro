import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./welcomeMail.service.ts', () => ({ processWelcomeMessage: vi.fn() }));

import { processWelcomeMessage } from './welcomeMail.service.ts';
import { handleDelivery } from './welcomeMail.consumer.ts';

function fakeChannel() {
  return { ack: vi.fn(), nack: vi.fn() };
}
const msg = { content: Buffer.from('{"userId":"u1","email":"a@b.c","name":"Ada"}') };

beforeEach(() => vi.clearAllMocks());

describe('handleDelivery maps service result → AMQP action', () => {
  it('ack → channel.ack', async () => {
    vi.mocked(processWelcomeMessage).mockResolvedValue({ action: 'ack' });
    const ch = fakeChannel();
    await handleDelivery(ch as never, msg as never);
    expect(ch.ack).toHaveBeenCalledWith(msg);
  });

  it('retry → nack(msg, false, true) (requeue)', async () => {
    vi.mocked(processWelcomeMessage).mockResolvedValue({ action: 'retry', reason: 'transient' });
    const ch = fakeChannel();
    await handleDelivery(ch as never, msg as never);
    expect(ch.nack).toHaveBeenCalledWith(msg, false, true);
  });

  it('dlq → nack(msg, false, false) (dead-letter)', async () => {
    vi.mocked(processWelcomeMessage).mockResolvedValue({ action: 'dlq', reason: 'exhausted' });
    const ch = fakeChannel();
    await handleDelivery(ch as never, msg as never);
    expect(ch.nack).toHaveBeenCalledWith(msg, false, false);
  });

  it('ignores a null delivery (consumer cancelled)', async () => {
    const ch = fakeChannel();
    await handleDelivery(ch as never, null);
    expect(ch.ack).not.toHaveBeenCalled();
    expect(ch.nack).not.toHaveBeenCalled();
  });
});
