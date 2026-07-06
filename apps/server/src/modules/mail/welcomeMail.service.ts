import { WelcomeEmailModel } from './welcomeEmail.schema.ts';
import { sendWelcomeEmail } from './mailer.ts';
import { logger } from '../../shared/utils/logger.ts';

const MAX_ATTEMPTS = 5;

export type WelcomeMessage = { userId: string; email: string; name: string };
export type ProcessResult = { action: 'ack' | 'retry' | 'dlq'; reason?: string };

function isDuplicateKeyError(err: unknown): boolean {
  return typeof err === 'object' && err !== null && (err as { code?: number }).code === 11000;
}

// nodemailer surfaces the SMTP reply code; a 5xx is a hard/permanent rejection.
function isPermanentMailError(err: unknown): boolean {
  const code = (err as { responseCode?: number } | null)?.responseCode;
  return typeof code === 'number' && code >= 500 && code < 600;
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

function toWelcomeMessage(parsed: unknown): WelcomeMessage | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const { userId, email, name } = parsed as Record<string, unknown>;
  if (typeof userId !== 'string' || !userId) return null;
  if (typeof email !== 'string' || !email) return null;
  return { userId, email, name: typeof name === 'string' ? name : '' };
}

export async function processWelcomeMessage(rawContent: string): Promise<ProcessResult> {
  // 1. Parse / validate. Unparseable JSON vs bad shape keep distinct reasons.
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawContent);
  } catch {
    logger.warn('[welcome-mail] unparseable message → DLQ');
    return { action: 'dlq', reason: 'unparseable' };
  }
  const msg = toWelcomeMessage(parsed);
  if (!msg) {
    logger.warn('[welcome-mail] malformed message → DLQ');
    return { action: 'dlq', reason: 'malformed' };
  }

  // 2. Atomic claim — plain {userId} upsert returns the doc (any status). A
  // concurrent fresh-insert race throws E11000 → the other delivery owns it → skip.
  // (Type inferred: findOneAndUpdate(..., { new: true }) → HydratedDocument | null.)
  let doc;
  try {
    doc = await WelcomeEmailModel.findOneAndUpdate(
      { userId: msg.userId },
      { $setOnInsert: { userId: msg.userId, email: msg.email, status: 'pending', attempts: 0 } },
      { upsert: true, new: true },
    );
  } catch (err) {
    if (isDuplicateKeyError(err)) return { action: 'ack', reason: 'concurrent-claim' };
    throw err; // unknown DB error → let the consumer nack(requeue)
  }
  if (!doc) return { action: 'retry', reason: 'no-doc' }; // defensive; new:true always returns a doc

  // 3. Decide BEFORE any send.
  if (doc.status === 'sent') return { action: 'ack', reason: 'duplicate' };
  if (doc.attempts >= MAX_ATTEMPTS) {
    await WelcomeEmailModel.updateOne(
      { userId: msg.userId },
      { status: 'failed', lastError: 'max attempts exceeded' },
    );
    return { action: 'dlq', reason: 'exhausted' };
  }

  // 4. status === 'pending' → send. Ack only after a confirmed send.
  try {
    await sendWelcomeEmail(msg.email, msg.name);
  } catch (err) {
    if (isPermanentMailError(err)) {
      await WelcomeEmailModel.updateOne(
        { userId: msg.userId },
        { status: 'failed', lastError: errMessage(err) },
      );
      return { action: 'dlq', reason: 'permanent' };
    }
    // transient: bump the failure counter (ONLY here), stay pending, retry
    await WelcomeEmailModel.updateOne(
      { userId: msg.userId },
      { $inc: { attempts: 1 }, $set: { lastError: errMessage(err) } },
    );
    return { action: 'retry', reason: 'transient' };
  }

  await WelcomeEmailModel.updateOne({ userId: msg.userId }, { status: 'sent', sentAt: new Date() });
  return { action: 'ack' };
}
