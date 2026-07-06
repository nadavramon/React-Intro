# Welcome mail via a queue (RabbitMQ) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. `/implement` owns execution.

**Goal:** On sign-up, send a welcome email asynchronously through RabbitMQ, delivered *effectively once* (at-least-once transport + an idempotent, durable-deduped consumer).

**Architecture:** better-auth's `databaseHooks.user.create.after` publishes `{ userId, email, name }` to a durable `welcome.email` queue (persistent message + publisher confirm). A same-process consumer (`prefetch(1)`, manual ack) runs the idempotent core `processWelcomeMessage`: it atomically claims the `userId` in a Mongo dedup collection (unique index), sends via nodemailer→Mailpit, marks `sent`, then acks. Ack only after a confirmed send; transient failures `nack(requeue)` (bounded by an attempts counter); poison messages dead-letter to a fanout DLX→DLQ. `rabbitmq.ts` owns its own connect/reconnect loop (amqplib does **not** auto-reconnect).

**Tech Stack:** Node 24 (ESM, `module: nodenext`), Express 5, Mongoose 9, better-auth 1.6, `amqplib`, `nodemailer`, RabbitMQ + Mailpit in Docker, Vitest. pnpm monorepo (`@repo/server`).

**Spec:** [docs/superpowers/specs/2026-07-06-welcome-mail-rabbitmq-queue-design.md](../specs/2026-07-06-welcome-mail-rabbitmq-queue-design.md)

---

## File map

| File | Responsibility |
| --- | --- |
| `apps/server/docker-compose.yml` | **modify** — add `rabbitmq` (broker + mgmt UI) and `mailpit` (SMTP sink + web inbox) |
| `apps/server/package.json` | **modify** — add `amqplib`, `nodemailer` (+ `@types/nodemailer`; amqplib self-types) |
| `apps/server/.env.example` | **modify** — document `RABBITMQ_URL`, `SMTP_HOST`, `SMTP_PORT`, `MAIL_FROM` |
| `apps/server/src/shared/config/env.ts` | **modify** — expose the four new vars (optional-with-default, like `REDIS_URL`) |
| `apps/server/src/modules/mail/welcomeEmail.schema.ts` | **create** — Mongoose dedup model (`userId` String + unique index, `status`, `attempts`, …) |
| `apps/server/src/modules/mail/mailer.ts` | **create** — nodemailer transport + `sendWelcomeEmail(email, name)` (empty-name fallback) |
| `apps/server/src/modules/mail/welcomeMail.service.ts` | **create** — `processWelcomeMessage(rawContent)`, the idempotent core |
| `apps/server/src/modules/mail/welcomeMail.service.test.ts` | **create** — the exactly-once unit suite |
| `apps/server/src/shared/config/rabbitmq.ts` | **create** — connection + channels + topology + reconnect loop |
| `apps/server/src/modules/mail/welcomeMail.publisher.ts` | **create** — `publishWelcomeEmail(msg)` (confirm channel, swallows errors) |
| `apps/server/src/modules/mail/welcomeMail.consumer.ts` | **create** — `startWelcomeConsumer()`; maps service result → ack/nack |
| `apps/server/src/shared/config/auth.ts` | **modify** — `databaseHooks.user.create.after` → `publishWelcomeEmail` |
| `apps/server/src/index.ts` | **modify** — boot: `connectRabbitMQ()` + `startWelcomeConsumer()`; shutdown |
| `apps/server/README.md`, root `CLAUDE.md` | **modify** — document the queue + dev stack |

**Conventions to honor** (verified against the current tree): relative imports carry explicit `.ts` extensions (`rewriteRelativeImportExtensions`); Mongoose models follow `new Schema({…},{ timestamps: true })` + `InferSchemaType` + `export const XModel = model('Name', schema)` (see `task.schema.ts`); the claim idiom `updateOne(filter, { $setOnInsert }, { upsert: true })` already lives in `like.service.ts`; unit tests mock the model via `vi.mock('./x.schema.ts', …)` and import the SUT after (see `task.service.test.ts`); `tsconfig` sets `exactOptionalPropertyTypes` (never assign `undefined` to an optional field) and **excludes `*.test.ts` from `tsc`** (so `as never` casts in tests are fine).

---

### Task 1: Docker services + dependencies + env vars

Infra + wiring. No unit test — verified by a **runtime smoke** (containers up, ports reachable). This unblocks every later task's manual verification.

**Files:**
- Modify: `apps/server/docker-compose.yml`
- Modify: `apps/server/package.json` (via `pnpm add`)
- Modify: `apps/server/src/shared/config/env.ts`
- Modify: `apps/server/.env.example`

- [x] **Step 1: Add the two services to `docker-compose.yml`**

Append to `services:` (keep the existing `redis` service and the `volumes:` block; add `rabbitmq-data` to it):

```yaml
  rabbitmq:
    image: rabbitmq:3-management-alpine # -management ships the web UI + CLI
    ports:
      - '5672:5672' # AMQP — the app connects here
      - '15672:15672' # management UI (guest/guest)
    volumes:
      - rabbitmq-data:/var/lib/rabbitmq # durable queues survive a restart
  mailpit:
    image: axllent/mailpit:v1.30 # pinned like rabbitmq — stable REST API
    ports:
      - '1025:1025' # SMTP sink (nodemailer connects here)
      - '8025:8025' # web inbox — watch the welcome mail land
```

And under `volumes:` add `rabbitmq-data:` next to `redis-data:`.

- [x] **Step 2: Add dependencies (pnpm — one root lockfile)**

Run from the repo root:

```bash
pnpm add --filter @repo/server amqplib nodemailer
pnpm add -D --filter @repo/server @types/nodemailer
```

`amqplib@2` **ships its own bundled types** (`node_modules/amqplib/index.d.ts`, which TypeScript resolves under `nodenext` in preference to `@types/amqplib`) — so **do not** add `@types/amqplib` (it's frozen on the stale pre-1.0 API and would only mislead). `nodemailer` ships no types, so `@types/nodemailer` is required. Both libs are pure-JS (no native post-install build), so **no `pnpm-workspace.yaml` `allowBuilds` entry is needed** (unlike `esbuild`/`bcrypt`). The root `pnpm-lock.yaml` updates in place — never create a per-package lockfile.

- [x] **Step 3: Expose the new env vars in `env.ts`**

Append to the `env` object (optional-with-default, mirroring `REDIS_URL`):

```ts
  RABBITMQ_URL: process.env.RABBITMQ_URL ?? 'amqp://localhost:5672',
  SMTP_HOST: process.env.SMTP_HOST ?? 'localhost',
  SMTP_PORT: Number(process.env.SMTP_PORT ?? 1025),
  MAIL_FROM: process.env.MAIL_FROM ?? 'React_Intro <no-reply@react-intro.local>',
```

Defaults point at the local Docker services, so **local dev needs no `.env/.env.dev` edits**. Document them in `.env.example` (Step 4) for prod.

- [x] **Step 4: Document the vars in `.env.example`**

Append:

```
# Welcome-mail queue + SMTP (defaults target the local docker services)
RABBITMQ_URL=amqp://localhost:5672
SMTP_HOST=localhost
SMTP_PORT=1025
MAIL_FROM=React_Intro <no-reply@react-intro.local>
```

- [x] **Step 5: Runtime smoke — bring the stack up**

```bash
cd apps/server && docker compose up -d
docker compose ps                                   # rabbitmq + mailpit + redis all "Up"
curl -fsS -u guest:guest http://localhost:15672/api/overview >/dev/null && echo "rabbitmq OK"
curl -fsS http://localhost:8025/api/v1/messages >/dev/null && echo "mailpit OK"
```

Expected: both `OK` lines print. Then `pnpm --filter @repo/server typecheck` → passes (env.ts still compiles).

- [x] **Step 6: Commit**

```bash
git add apps/server/docker-compose.yml apps/server/package.json apps/server/.env.example apps/server/src/shared/config/env.ts pnpm-lock.yaml
git commit -m "chore(server): rabbitmq + mailpit docker services, amqplib/nodemailer deps, mail env"
```

---

### Task 2: Dedup model (`welcomeEmail.schema.ts`)

The durable idempotency record. `userId` is a **String** (better-auth's `user.id`), unique-indexed — *not* an `ObjectId` like the other modules.

**Files:**
- Create: `apps/server/src/modules/mail/welcomeEmail.schema.ts`
- Test: `apps/server/src/modules/mail/welcomeEmail.schema.test.ts`

- [x] **Step 1: Write the failing test** (`welcomeEmail.schema.test.ts`)

A Mongoose model can be instantiated without a DB connection, so defaults + the unique index are checkable offline:

```ts
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
```

- [x] **Step 2: Run it — expect FAIL** (`Cannot find module './welcomeEmail.schema.ts'`)

```bash
pnpm --filter @repo/server test welcomeEmail.schema
```

- [x] **Step 3: Implement the model**

```ts
import { Schema, model, InferSchemaType, Types } from 'mongoose';

const welcomeEmailSchema = new Schema(
  {
    userId: { type: String, required: true, unique: true }, // better-auth user.id (string), the idempotency key
    email: { type: String, required: true },
    status: { type: String, enum: ['pending', 'sent', 'failed'], default: 'pending' },
    attempts: { type: Number, default: 0 }, // transient-send-failure counter (NOT a redelivery counter)
    sentAt: { type: Date },
    lastError: { type: String },
  },
  { timestamps: true },
);

export type WelcomeEmailDoc = InferSchemaType<typeof welcomeEmailSchema> & {
  _id: Types.ObjectId;
};

export const WelcomeEmailModel = model('WelcomeEmail', welcomeEmailSchema);
```

- [x] **Step 4: Run it — expect PASS**

```bash
pnpm --filter @repo/server test welcomeEmail.schema
```

- [x] **Step 5: Commit**

```bash
git add apps/server/src/modules/mail/welcomeEmail.schema.ts apps/server/src/modules/mail/welcomeEmail.schema.test.ts
git commit -m "feat(server): welcome-email dedup model (userId String, unique index)"
```

---

### Task 3: Mailer (`mailer.ts`)

nodemailer transport + `sendWelcomeEmail`. The greeting must tolerate an empty `name` (better-auth's email sign-up allows `name: ''`).

**Files:**
- Create: `apps/server/src/modules/mail/mailer.ts`
- Test: `apps/server/src/modules/mail/mailer.test.ts`

- [x] **Step 1: Write the failing test** (`mailer.test.ts`)

Mock nodemailer; assert the greeting fallback and the envelope. `renderWelcome` is a pure helper so the copy is testable without the transport:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMail = vi.fn().mockResolvedValue({ messageId: 'x' });
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
```

- [x] **Step 2: Run it — expect FAIL**

```bash
pnpm --filter @repo/server test mailer
```

- [x] **Step 3: Implement `mailer.ts`**

```ts
import nodemailer from 'nodemailer';
import { env } from '../../shared/config/env.ts';

const transport = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: false, // Mailpit speaks plain SMTP on 1025
});

export function renderWelcome(name: string): { subject: string; text: string } {
  const greeting = name.trim() || 'there';
  return {
    subject: 'Welcome to React_Intro!',
    text: `Hi ${greeting}, thanks for signing up. Your account is ready.`,
  };
}

export async function sendWelcomeEmail(email: string, name: string): Promise<void> {
  const { subject, text } = renderWelcome(name);
  await transport.sendMail({ from: env.MAIL_FROM, to: email, subject, text });
}
```

- [x] **Step 4: Run it — expect PASS**

```bash
pnpm --filter @repo/server test mailer
```

- [x] **Step 5: Commit**

```bash
git add apps/server/src/modules/mail/mailer.ts apps/server/src/modules/mail/mailer.test.ts
git commit -m "feat(server): nodemailer welcome mailer with empty-name greeting fallback"
```

---

### Task 4: The idempotent core (`welcomeMail.service.ts`)

The heart of the assignment. `processWelcomeMessage(rawContent)` parses, atomically claims `userId`, sends, marks `sent`, and returns one of `ack` / `retry` / `dlq`. **This task carries the exactly-once guarantee.**

**Files:**
- Create: `apps/server/src/modules/mail/welcomeMail.service.ts`
- Test: `apps/server/src/modules/mail/welcomeMail.service.test.ts`

**Skills:** test-driven-development

- [x] **Step 1: Write the failing test** (`welcomeMail.service.test.ts`) — the full exactly-once suite

```ts
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
const claim = (doc: object) => vi.mocked(WelcomeEmailModel.findOneAndUpdate).mockResolvedValue(doc as never);

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
    vi.mocked(sendWelcomeEmail).mockRejectedValue(Object.assign(new Error('550 no such user'), { responseCode: 550 }));
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
```

- [x] **Step 2: Run it — expect FAIL** (`Cannot find module './welcomeMail.service.ts'`)

```bash
pnpm --filter @repo/server test welcomeMail.service
```

- [x] **Step 3: Implement `welcomeMail.service.ts`**

```ts
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
      await WelcomeEmailModel.updateOne({ userId: msg.userId }, { status: 'failed', lastError: errMessage(err) });
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
```

- [x] **Step 4: Run it — expect all PASS**

```bash
pnpm --filter @repo/server test welcomeMail.service
```

- [x] **Step 5: Commit**

```bash
git add apps/server/src/modules/mail/welcomeMail.service.ts apps/server/src/modules/mail/welcomeMail.service.test.ts
git commit -m "feat(server): idempotent processWelcomeMessage — dedup claim, ack/retry/dlq"
```

---

### Task 5: RabbitMQ connection + topology + reconnect (`rabbitmq.ts`)

Owns the connection, a shared **confirm** channel for publishing, the topology (fanout DLX → DLQ, main queue dead-lettering to it), and its **own reconnect loop** (amqplib does not auto-reconnect). Consumers register a re-subscribe callback via `onRabbitReady`, re-run on every (re)connect.

**Files:**
- Create: `apps/server/src/shared/config/rabbitmq.ts`

No unit test (a reconnect loop against a real broker isn't meaningfully unit-testable); covered by the boot smoke in Step 3 and the integration proof in Task 9.

- [x] **Step 1: Implement `rabbitmq.ts`**

```ts
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
```

- [x] **Step 2: Typecheck**

```bash
pnpm --filter @repo/server typecheck
```

Expected: PASS. (amqplib's own bundled types export `ChannelModel` / `ConfirmChannel` and type `connect()` as `Promise<ChannelModel>`, so the imports compile as written.)

- [x] **Step 3: Boot smoke (deferred to Task 8 wiring)**

`rabbitmq.ts` isn't reachable until `index.ts` calls `connectRabbitMQ()` (Task 8). No standalone run here; commit and proceed.

- [x] **Step 4: Commit**

```bash
git add apps/server/src/shared/config/rabbitmq.ts
git commit -m "feat(server): rabbitmq config — confirm channel, fanout DLX topology, self-reconnect"
```

---

### Task 6: Publisher (`welcomeMail.publisher.ts`)

`publishWelcomeEmail(msg)` — persistent message on the confirm channel, awaits `waitForConfirms()`, and **swallows all errors** so the sign-up hook can never throw.

**Files:**
- Create: `apps/server/src/modules/mail/welcomeMail.publisher.ts`
- Test: `apps/server/src/modules/mail/welcomeMail.publisher.test.ts`

- [ ] **Step 1: Write the failing test** (`welcomeMail.publisher.test.ts`)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

const getPublishChannel = vi.fn();
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
    await expect(publishWelcomeEmail({ userId: 'u1', email: 'a@b.c', name: '' })).resolves.toBeUndefined();
  });

  it('never throws when waitForConfirms rejects (broker nack)', async () => {
    getPublishChannel.mockReturnValue({
      sendToQueue: vi.fn().mockReturnValue(true),
      waitForConfirms: vi.fn().mockRejectedValue(new Error('nack')),
    });
    await expect(publishWelcomeEmail({ userId: 'u1', email: 'a@b.c', name: '' })).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

```bash
pnpm --filter @repo/server test welcomeMail.publisher
```

- [ ] **Step 3: Implement `welcomeMail.publisher.ts`**

```ts
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
```

- [ ] **Step 4: Run it — expect PASS**

```bash
pnpm --filter @repo/server test welcomeMail.publisher
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/mail/welcomeMail.publisher.ts apps/server/src/modules/mail/welcomeMail.publisher.test.ts
git commit -m "feat(server): welcome-mail publisher — persistent + confirm, error-swallowing"
```

---

### Task 7: Consumer (`welcomeMail.consumer.ts`)

`startWelcomeConsumer()` registers a re-subscribe callback with `rabbitmq.ts`: open a channel, `prefetch(1)`, `consume`, and map `processWelcomeMessage`'s result to ack / nack(requeue) / nack(→DLQ).

**Files:**
- Create: `apps/server/src/modules/mail/welcomeMail.consumer.ts`
- Test: `apps/server/src/modules/mail/welcomeMail.consumer.test.ts`

- [ ] **Step 1: Write the failing test** (`welcomeMail.consumer.test.ts`) — verify the result→AMQP mapping

```ts
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
```

- [ ] **Step 2: Run it — expect FAIL**

```bash
pnpm --filter @repo/server test welcomeMail.consumer
```

- [ ] **Step 3: Implement `welcomeMail.consumer.ts`**

```ts
import type { Channel, ConsumeMessage } from 'amqplib';
import { getConnection, onRabbitReady, WELCOME_QUEUE } from '../../shared/config/rabbitmq.ts';
import { logger } from '../../shared/utils/logger.ts';
import { processWelcomeMessage } from './welcomeMail.service.ts';

// Exported for unit testing the result→AMQP mapping.
export async function handleDelivery(channel: Channel, msg: ConsumeMessage | null): Promise<void> {
  if (!msg) return; // consumer cancelled by the broker
  const result = await processWelcomeMessage(msg.content.toString());
  if (result.action === 'ack') channel.ack(msg);
  else if (result.action === 'retry') channel.nack(msg, false, true); // requeue
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
```

- [ ] **Step 4: Run it — expect PASS**

```bash
pnpm --filter @repo/server test welcomeMail.consumer
```

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/modules/mail/welcomeMail.consumer.ts apps/server/src/modules/mail/welcomeMail.consumer.test.ts
git commit -m "feat(server): welcome-mail consumer — prefetch(1), result→ack/nack mapping"
```

---

### Task 8: Wire the sign-up hook + boot/shutdown

Connect the seam: better-auth publishes on user creation; `index.ts` connects the broker and starts the consumer at boot and tears them down on shutdown.

**Files:**
- Modify: `apps/server/src/shared/config/auth.ts`
- Modify: `apps/server/src/index.ts`

- [ ] **Step 1: Add the `databaseHooks` block to `auth.ts`**

Import at the top: `import { publishWelcomeEmail } from '../../modules/mail/welcomeMail.publisher.ts';`

Add inside the `betterAuth({ … })` config object (e.g. after the `session` block):

```ts
  databaseHooks: {
    user: {
      create: {
        after: async (user) => {
          // The user row is already committed before this runs (create.after is
          // post-write, and transaction:false means no DB transaction). An uncaught
          // throw here would fail the sign-up REQUEST (no rollback), so publishWelcomeEmail
          // swallows all errors and resolves to void — the hook never throws.
          await publishWelcomeEmail({ userId: user.id, email: user.email, name: user.name });
        },
      },
    },
  },
```

- [ ] **Step 2: Wire boot + shutdown in `index.ts`**

Add imports:

```ts
import { connectRabbitMQ, disconnectRabbitMQ } from './shared/config/rabbitmq.ts';
import { startWelcomeConsumer } from './modules/mail/welcomeMail.consumer.ts';
```

In `start()`, after `connectRedis();`:

```ts
  startWelcomeConsumer(); // registers the re-subscribe callback (runs on connect)
  await connectRabbitMQ(); // resolves even if the broker is down (self-retries)
```

And add `disconnectRabbitMQ()` to the shutdown `Promise.all`:

```ts
      await Promise.all([disconnectDB(), disconnectRedis(), disconnectRabbitMQ()]);
```

- [ ] **Step 3: Typecheck + full unit suite**

```bash
pnpm --filter @repo/server typecheck && pnpm --filter @repo/server test
```

Expected: typecheck passes; all unit specs (existing + the new mail specs) green.

- [ ] **Step 4: Boot smoke — the broker connects and the consumer subscribes**

With Task 1's docker services up:

```bash
cd apps/server && pnpm dev
```

Expected logs: `Connected to RabbitMQ` and `[welcome-mail] consumer subscribed to welcome.email`. In the RabbitMQ mgmt UI (<http://localhost:15672>) the `welcome.email`, `welcome.email.dlq` queues and `welcome.email.dlx` exchange exist. Stop with Ctrl-C → `Disconnected from RabbitMQ`. (Also verify graceful degradation: stop the rabbitmq container, restart `pnpm dev` → it logs `RabbitMQ unavailable, retrying in 3s` and does **not** crash; `docker compose start rabbitmq` → it logs `Connected to RabbitMQ` and subscribes.)

- [ ] **Step 5: Commit**

```bash
git add apps/server/src/shared/config/auth.ts apps/server/src/index.ts
git commit -m "feat(server): publish welcome mail on sign-up; boot/shutdown the queue consumer"
```

---

### Task 9: Exactly-once proof (live) + docs

Prove the whole assignment end to end against real infra, then document it. Per infra-testing discipline, this **runs the real artifact**, not just unit mocks.

**Files:**
- Modify: `apps/server/README.md`
- Modify: root `CLAUDE.md` (Stack + dev-services note)

- [ ] **Step 1: Live exactly-once check**

With docker services up and `pnpm dev` running (server on :3000):

```bash
# 1. Fresh sign-up (better-auth email sign-up). Unique email per run so re-runs
#    create a new user instead of hitting "user already exists". Capture the id.
EMAIL="ada+wq-$(date +%s)@example.com"
curl -s -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d "{\"name\":\"Ada\",\"email\":\"$EMAIL\",\"password\":\"Sup3rSecret!\"}" | tee /tmp/signup.json
USER_ID=$(node -e "process.stdout.write(require('/tmp/signup.json').user?.id ?? '')")
[ -n "$USER_ID" ] || { echo "no user id in sign-up response:"; cat /tmp/signup.json; exit 1; }
echo "userId=$USER_ID email=$EMAIL"

# 2. Exactly one welcome mail arrived.
sleep 2
curl -s http://localhost:8025/api/v1/messages | EMAIL="$EMAIL" node -e \
  "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const m=JSON.parse(s).messages;console.log('mails:', m.filter(x=>x.To.some(t=>t.Address===process.env.EMAIL)).length)})"
# expect: mails: 1

# 3. Simulate a redelivery: re-publish the SAME message straight to the queue via
#    the RabbitMQ HTTP API (bypasses the app, mimics an at-least-once redelivery).
curl -s -u guest:guest -H 'content-type:application/json' \
  -X POST http://localhost:15672/api/exchanges/%2f/amq.default/publish \
  -d "{\"properties\":{\"delivery_mode\":2},\"routing_key\":\"welcome.email\",\"payload\":\"{\\\"userId\\\":\\\"$USER_ID\\\",\\\"email\\\":\\\"$EMAIL\\\",\\\"name\\\":\\\"Ada\\\"}\",\"payload_encoding\":\"string\"}"

# 4. Still exactly one — the dedup record (status 'sent') made the redelivery a no-op skip.
sleep 2
curl -s http://localhost:8025/api/v1/messages | EMAIL="$EMAIL" node -e \
  "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const m=JSON.parse(s).messages;console.log('mails:', m.filter(x=>x.To.some(t=>t.Address===process.env.EMAIL)).length)})"
# expect: mails: 1  ← EXACTLY ONCE proven
```

Expected: step 2 prints `1`, step 4 still prints `1`. (View the mail in the Mailpit inbox at <http://localhost:8025>.)

- [ ] **Step 2: Update docs**

- `apps/server/README.md`: add a "Welcome mail (queue)" section — the flow diagram from the spec, the dev services (`docker compose up -d` now brings rabbitmq + mailpit), and the exactly-once explanation (at-least-once transport + idempotent consumer).
- Root `CLAUDE.md`: in the Stack/Testing notes, mention RabbitMQ + Mailpit are part of the server dev stack and the `modules/mail/` feature.

- [ ] **Step 3: Full gauntlet (mirrors CI)**

```bash
pnpm format:check && pnpm turbo run lint typecheck test
```

Expected: all green. (Run `/check` as the equivalent.)

- [ ] **Step 4: Commit**

```bash
git add apps/server/README.md CLAUDE.md
git commit -m "docs(server): document the welcome-mail queue + exactly-once proof"
```

---

## Self-review notes

- **Spec coverage:** Phase 1 (docker) → Task 1; Phase 2 (publish on sign-up) → Tasks 6 + 8; Phase 3 (consumer) → Tasks 5 + 7; Phase 4 (exactly-once core) → Tasks 2 + 4; Phase 5 (ack policy / DLQ / retries) → Tasks 5 (topology) + 7 (mapping) + 4 (attempts cap). The three assignment questions are answered in the spec and surfaced in the README (Task 9).
- **Deferred (spec "out of scope"):** transactional outbox, TTL back-off retry queue, separate worker process — not tasked.
- **Type consistency:** `WelcomeMessage` / `ProcessResult` are defined in Task 4 and imported by Tasks 6–7; `WELCOME_QUEUE` / `WELCOME_DLX` / `WELCOME_DLQ` / `getPublishChannel` / `getConnection` / `onRabbitReady` are defined in Task 5 and consumed in Tasks 6–7; `sendWelcomeEmail` (Task 3) and `WelcomeEmailModel` (Task 2) are consumed in Task 4.
- **`exactOptionalPropertyTypes`:** `ProcessResult.reason?` is always omitted (never set to `undefined`); optional model fields (`sentAt`, `lastError`) are only ever set to real values.
