import { describe, it, expect, vi, beforeEach } from 'vitest';

const getPublishChannel = vi.hoisted(() => vi.fn());
vi.mock('../../shared/config/rabbitmq.ts', () => ({
  WELCOME_QUEUE: 'welcome.email',
  getPublishChannel,
}));

import { publishWelcomeEmail } from './welcomeMail.publisher.ts';

beforeEach(() => vi.clearAllMocks());

describe('publishWelcomeEmail', () => {
  it('publishes a persistent JSON message and waits for broker confirm', async () => {
    const sendToQueue = vi.fn().mockReturnValue(true);
    const waitForConfirms = vi.fn().mockResolvedValue(undefined);
    getPublishChannel.mockReturnValue({ sendToQueue, waitForConfirms });

    await publishWelcomeEmail({ userId: 'u1', email: 'a@b.c', name: 'Ada' });

    const [queue, buf, opts] = sendToQueue.mock.calls[0];
    expect(queue).toBe('welcome.email');
    expect(JSON.parse(buf.toString())).toEqual({ userId: 'u1', email: 'a@b.c', name: 'Ada' });
    expect(opts).toEqual(expect.objectContaining({ persistent: true }));
    expect(waitForConfirms).toHaveBeenCalled();
  });

  it('never throws when the broker is down (no channel)', async () => {
    getPublishChannel.mockReturnValue(null);
    await expect(
      publishWelcomeEmail({ userId: 'u1', email: 'a@b.c', name: '' }),
    ).resolves.toBeUndefined();
  });

  it('never throws when waitForConfirms rejects (broker nack)', async () => {
    getPublishChannel.mockReturnValue({
      sendToQueue: vi.fn().mockReturnValue(true),
      waitForConfirms: vi.fn().mockRejectedValue(new Error('nack')),
    });
    await expect(
      publishWelcomeEmail({ userId: 'u1', email: 'a@b.c', name: '' }),
    ).resolves.toBeUndefined();
  });
});
