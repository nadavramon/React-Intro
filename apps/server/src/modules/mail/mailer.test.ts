import { describe, it, expect, vi, beforeEach } from 'vitest';

// vi.hoisted: mailer.ts calls createTransport at import time, so the hoisted
// vi.mock factory runs during that import — before a plain top-level `const`
// would initialize (TDZ). Hoisting `sendMail` alongside the factory fixes the order.
const { sendMail } = vi.hoisted(() => ({
  sendMail: vi.fn().mockResolvedValue({ messageId: 'x' }),
}));
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

import { renderWelcome, sendWelcomeEmail } from './mailer.ts';

beforeEach(() => vi.clearAllMocks());

describe('renderWelcome', () => {
  it('greets by name when present', () => {
    expect(renderWelcome('Ada').text).toContain('Hi Ada');
  });
  it('falls back to a generic greeting when name is empty', () => {
    expect(renderWelcome('').text).toContain('Hi there');
    expect(renderWelcome('   ').text).toContain('Hi there');
  });
});

describe('sendWelcomeEmail', () => {
  it('sends to the address with the configured from + subject', async () => {
    await sendWelcomeEmail('a@b.c', 'Ada');
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: 'a@b.c', subject: expect.stringContaining('Welcome') }),
    );
  });
});
