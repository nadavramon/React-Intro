import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./welcomeEmail.schema.ts', () => ({
  WelcomeEmailModel: { findOneAndUpdate: vi.fn(), updateOne: vi.fn() },
}));
vi.mock('./mailer.ts', () => ({ sendWelcomeEmail: vi.fn() }));

import { WelcomeEmailModel } from './welcomeEmail.schema.ts';
import { sendWelcomeEmail } from './mailer.ts';
import { processWelcomeMessage } from './welcomeMail.service.ts';

const body = (o: object) => JSON.stringify(o);
const good = { userId: 'u1', email: 'a@b.c', name: 'Ada' };
// findOneAndUpdate returns the claimed doc; default = a fresh pending claim
const claim = (doc: object) =>
  vi.mocked(WelcomeEmailModel.findOneAndUpdate).mockResolvedValue(doc as never);

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(WelcomeEmailModel.updateOne).mockResolvedValue({} as never);
  vi.mocked(sendWelcomeEmail).mockResolvedValue(undefined);
});

describe('processWelcomeMessage — exactly once', () => {
  it('fresh claim → sends once, records sent, acks', async () => {
    claim({ userId: 'u1', email: 'a@b.c', status: 'pending', attempts: 0 });
    const r = await processWelcomeMessage(body(good));
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(WelcomeEmailModel.updateOne).toHaveBeenCalledWith(
      { userId: 'u1' },
      expect.objectContaining({ status: 'sent' }),
    );
    expect(r).toEqual({ action: 'ack' });
  });

  it('already sent → skips, NO second mail, acks', async () => {
    claim({ userId: 'u1', email: 'a@b.c', status: 'sent', attempts: 0 });
    const r = await processWelcomeMessage(body(good));
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
    expect(r).toEqual({ action: 'ack', reason: 'duplicate' });
  });

  it('concurrent-claim race (findOneAndUpdate throws E11000) → caught, acks, no send', async () => {
    vi.mocked(WelcomeEmailModel.findOneAndUpdate).mockRejectedValue({ code: 11000 } as never);
    const r = await processWelcomeMessage(body(good));
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
    expect(r).toEqual({ action: 'ack', reason: 'concurrent-claim' });
  });

  it('pending from a prior crash → resends, marks sent', async () => {
    claim({ userId: 'u1', email: 'a@b.c', status: 'pending', attempts: 1 });
    const r = await processWelcomeMessage(body(good));
    expect(sendWelcomeEmail).toHaveBeenCalledTimes(1);
    expect(r).toEqual({ action: 'ack' });
  });

  it('transient send failure → retry, increments attempts, stays pending, no sent record', async () => {
    claim({ userId: 'u1', email: 'a@b.c', status: 'pending', attempts: 0 });
    vi.mocked(sendWelcomeEmail).mockRejectedValue(Object.assign(new Error('ECONNREFUSED'), {}));
    const r = await processWelcomeMessage(body(good));
    expect(r).toEqual({ action: 'retry', reason: 'transient' });
    expect(WelcomeEmailModel.updateOne).toHaveBeenCalledWith(
      { userId: 'u1' },
      expect.objectContaining({ $inc: { attempts: 1 } }),
    );
    expect(WelcomeEmailModel.updateOne).not.toHaveBeenCalledWith(
      { userId: 'u1' },
      expect.objectContaining({ status: 'sent' }),
    );
  });

  it('successful (re)send does NOT increment attempts (benign redelivery safe)', async () => {
    claim({ userId: 'u1', email: 'a@b.c', status: 'pending', attempts: 2 });
    await processWelcomeMessage(body(good));
    expect(WelcomeEmailModel.updateOne).not.toHaveBeenCalledWith(
      { userId: 'u1' },
      expect.objectContaining({ $inc: expect.anything() }),
    );
  });

  it('attempts exhausted → dlq BEFORE calling the mailer', async () => {
    claim({ userId: 'u1', email: 'a@b.c', status: 'pending', attempts: 5 });
    const r = await processWelcomeMessage(body(good));
    expect(sendWelcomeEmail).not.toHaveBeenCalled();
    expect(r).toEqual({ action: 'dlq', reason: 'exhausted' });
  });

  it('permanent send failure (SMTP 5xx) → dlq', async () => {
    claim({ userId: 'u1', email: 'a@b.c', status: 'pending', attempts: 0 });
    vi.mocked(sendWelcomeEmail).mockRejectedValue(
      Object.assign(new Error('550 no such user'), { responseCode: 550 }),
    );
    const r = await processWelcomeMessage(body(good));
    expect(r).toEqual({ action: 'dlq', reason: 'permanent' });
  });

  it('unparseable JSON → dlq', async () => {
    const r = await processWelcomeMessage('not json{');
    expect(r).toEqual({ action: 'dlq', reason: 'unparseable' });
  });

  it('missing userId → dlq', async () => {
    const r = await processWelcomeMessage(body({ email: 'a@b.c', name: 'x' }));
    expect(r).toEqual({ action: 'dlq', reason: 'malformed' });
  });
});
