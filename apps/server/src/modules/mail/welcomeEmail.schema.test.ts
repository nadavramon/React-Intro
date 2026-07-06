import { describe, it, expect } from 'vitest';
import { WelcomeEmailModel } from './welcomeEmail.schema.ts';

describe('WelcomeEmailModel', () => {
  it('defaults status to pending and attempts to 0', () => {
    const doc = new WelcomeEmailModel({ userId: 'u1', email: 'a@b.c' });
    expect(doc.status).toBe('pending');
    expect(doc.attempts).toBe(0);
  });

  it('declares a unique index on userId', () => {
    const userIdPath = WelcomeEmailModel.schema.path('userId');
    expect(userIdPath.instance).toBe('String');
    expect(userIdPath.options.unique).toBe(true);
  });
});
