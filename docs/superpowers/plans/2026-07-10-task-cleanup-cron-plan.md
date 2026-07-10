# Task Cleanup Cron (Soft Delete) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A daily `node-cron` job in the Express server soft-deletes todos completed more than 7 days ago; soft delete becomes the app's only deletion semantic and every read query filters it out.

**Architecture:** Three server-internal fields (`completedAt`, `isDeleted`, `deletedAt`) on the task schema; service layer owns the `completedAt` transition logic and the `isDeleted: { $ne: true }` read filter; a new `task.cleanup.ts` module holds the idempotent `cleanupOldTasks()` job guarded by a best-effort Redis `SET NX PX` lock, scheduled at `0 3 * * *` from `index.ts` only (Vitest imports `app.ts`, so tests stay cron-free). Shared contract (`@repo/shared`) unchanged — nothing new crosses the HTTP boundary.

**Tech Stack:** node-cron 4 (new dep, bundled types), date-fns `subDays` (already installed), existing ioredis client, Mongoose 9, Vitest.

**Spec:** `docs/superpowers/specs/2026-07-10-task-cleanup-cron-design.md`
**Branch:** `feat/task-cleanup-cron` (already created; spec commit `dd375c6` is on it)

**Deviation from spec:** backfill script lives at `apps/server/src/scripts/backfill-completed-at.ts` (not `apps/server/scripts/`) — tsconfig `include` is `src/**` only, so inside `src/` it gets typechecked and hook-covered.

---

## File map

| File | Change |
| --- | --- |
| `apps/server/package.json` | Add `node-cron` dependency |
| `apps/server/src/modules/task/task.schema.ts` | Modify — 3 new fields + compound index |
| `apps/server/src/modules/task/task.service.ts` | Modify — soft delete, read filters, `completedAt` transitions |
| `apps/server/src/modules/task/task.service.test.ts` | Modify — new/updated specs |
| `apps/server/src/modules/task/task.cleanup.ts` | Create — job logic + lock + cron start/stop |
| `apps/server/src/modules/task/task.cleanup.test.ts` | Create |
| `apps/server/src/index.ts` | Modify — start cron on boot, stop on shutdown |
| `apps/server/src/scripts/backfill-completed-at.ts` | Create — one-off backfill |
| `apps/server/README.md` | Modify — "Task cleanup (cron)" section |

Note: `toTask()` needs no change — it projects through `taskSchema.parse` with an explicit field pick, so the new fields never leak to the client (the contract stays enforced by construction).

---

### Task 1: Dependency + schema fields

**Files:**
- Modify: `apps/server/package.json` (via pnpm)
- Modify: `apps/server/src/modules/task/task.schema.ts`

- [x] **Step 1: Install node-cron**

Run from the repo root:
```bash
pnpm --filter @repo/server add node-cron
```
Expected: `node-cron ^4.6.0` in `apps/server/package.json` dependencies; root `pnpm-lock.yaml` updated (one lockfile — never create a per-package one). v4 bundles its own types; do NOT add `@types/node-cron`.

- [x] **Step 2: Add the three fields + compound index**

In `task.schema.ts`, replace the schema definition:

```ts
const taskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    isCompleted: { type: Boolean, default: false },
    // Server-internal lifecycle fields — deliberately NOT in @repo/shared:
    // none of them cross the HTTP boundary (toTask strips them via parse).
    completedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Covers the nightly cleanup query (isDeleted + isCompleted + completedAt range).
taskSchema.index({ isDeleted: 1, isCompleted: 1, completedAt: 1 });
```

- [x] **Step 3: Typecheck + existing tests still green**

```bash
pnpm --filter @repo/server typecheck && pnpm --filter @repo/server test
```
Expected: clean; new fields have defaults so nothing existing breaks.

- [x] **Step 4: Commit**

```bash
git add apps/server/package.json pnpm-workspace.yaml pnpm-lock.yaml apps/server/src/modules/task/task.schema.ts
git commit -m "feat(server): task lifecycle fields (completedAt/isDeleted/deletedAt) + node-cron dep"
```
(`pnpm-workspace.yaml` only if pnpm touched it; check `git status`.)

---

### Task 2: Soft delete + read filters in the service

**Files:**
- Modify: `apps/server/src/modules/task/task.service.ts`
- Test: `apps/server/src/modules/task/task.service.test.ts`

- [x] **Step 1: Write the failing tests**

In `task.service.test.ts`, update the `TaskModel` mock factory (deleteTask stops using `findOneAndDelete`; `findOne` is needed here and by Task 3). Factories stay self-contained — inline `vi.fn()` only, no outer consts (else vi.mock hoisting throws a TDZ ReferenceError; see the vi.hoisted memory):

```ts
vi.mock('./task.schema.ts', () => ({
  TaskModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));
```

Import `NotFoundError` at the top:
```ts
import { NotFoundError } from '../../shared/errors/AppError.ts';
```

Update the existing miss-path assertion in `getAllTasks` ("queries Mongo and writes cache on miss"):
```ts
expect(TaskModel.find).toHaveBeenCalledWith({ userId, isDeleted: { $ne: true } });
```

Replace the existing `deleteTask` spec and add a new describe block:

```ts
describe('deleteTask soft-deletes', () => {
  it('flips isDeleted/deletedAt instead of removing the doc, then invalidates', async () => {
    vi.mocked(TaskModel.findOneAndUpdate).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);

    await deleteTask(userId, 't1');

    expect(TaskModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 't1', userId, isDeleted: { $ne: true } },
      { isDeleted: true, deletedAt: expect.any(Date) },
    );
    expect(taskCache.invalidate).toHaveBeenCalledWith(userId);
  });

  it('404s when the task is missing or already soft-deleted', async () => {
    vi.mocked(TaskModel.findOneAndUpdate).mockReturnValue({
      lean: () => Promise.resolve(null),
    } as never);

    await expect(deleteTask(userId, 't1')).rejects.toThrow(NotFoundError);
    expect(taskCache.invalidate).not.toHaveBeenCalled();
  });
});
```

Also update the old "deleteTask invalidates after a successful delete" spec to mock `findOneAndUpdate` instead of `findOneAndDelete` (or fold it into the block above and delete the old one — preferred).

- [x] **Step 2: Run to verify failure**

```bash
pnpm --filter @repo/server test -- task.service
```
Expected: FAIL — `find` called without the `isDeleted` filter; `deleteTask` still calls the (now unmocked) `findOneAndDelete`.

- [x] **Step 3: Implement in `task.service.ts`**

`getAllTasks` — the Mongo query becomes:
```ts
const docs = await TaskModel.find({ userId, isDeleted: { $ne: true } }).lean();
```

`getTaskById`:
```ts
const doc = await TaskModel.findOne({ _id: id, userId, isDeleted: { $ne: true } }).lean();
```

`deleteTask` (replace the whole function; `findOneAndDelete` import usage disappears):
```ts
export async function deleteTask(userId: string, id: string): Promise<void> {
  // Soft delete: deletion is a state, not an event — restorable, auditable,
  // and the same isDeleted filter hides it from every read.
  const doc = await TaskModel.findOneAndUpdate(
    { _id: id, userId, isDeleted: { $ne: true } },
    { isDeleted: true, deletedAt: new Date() },
  ).lean();
  if (!doc) throw new NotFoundError('Task not found');

  logger.info(`Task soft-deleted: id=${id}`);
  await taskCache.invalidate(userId);
}
```

(`getTasksByStatus` derives from `getAllTasks`, so it's covered for free. `updateTask`'s filter changes in Task 3 together with the transition logic.)

- [x] **Step 4: Run tests — pass**

```bash
pnpm --filter @repo/server test -- task.service
```
Expected: PASS.

- [x] **Step 5: Commit**

```bash
git add apps/server/src/modules/task/task.service.ts apps/server/src/modules/task/task.service.test.ts
git commit -m "feat(server): soft delete tasks; reads exclude deleted"
```

---

### Task 3: `completedAt` transition logic (create + update)

**Files:**
- Modify: `apps/server/src/modules/task/task.service.ts`
- Test: `apps/server/src/modules/task/task.service.test.ts`

- [x] **Step 1: Write the failing tests**

Add to `task.service.test.ts`:

```ts
describe('completedAt tracks the completion transition', () => {
  const currentIncomplete = { ...docA, isCompleted: false };
  const currentComplete = { ...docA, isCompleted: true };

  function mockCurrent(doc: unknown) {
    vi.mocked(TaskModel.findOne).mockReturnValue({
      lean: () => Promise.resolve(doc),
    } as never);
    vi.mocked(TaskModel.findOneAndUpdate).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);
  }

  it('createTask with isCompleted:true stamps completedAt', async () => {
    vi.mocked(TaskModel.create).mockResolvedValue({ toObject: () => docA } as never);
    await createTask(userId, { title: 'A', isCompleted: true } as never);
    expect(TaskModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ isCompleted: true, completedAt: expect.any(Date) }),
    );
  });

  it('createTask default leaves completedAt null', async () => {
    vi.mocked(TaskModel.create).mockResolvedValue({ toObject: () => docA } as never);
    await createTask(userId, { title: 'A' } as never);
    expect(TaskModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ completedAt: null }),
    );
  });

  it('update false→true stamps completedAt', async () => {
    mockCurrent(currentIncomplete);
    await updateTask(userId, 't1', { isCompleted: true } as never);
    expect(TaskModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 't1', userId },
      expect.objectContaining({ completedAt: expect.any(Date) }),
      expect.anything(),
    );
  });

  it('update true→false clears completedAt (clock restarts on re-complete)', async () => {
    mockCurrent(currentComplete);
    await updateTask(userId, 't1', { isCompleted: false } as never);
    expect(TaskModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 't1', userId },
      expect.objectContaining({ completedAt: null }),
      expect.anything(),
    );
  });

  it('redundant isCompleted:true does NOT reset the clock', async () => {
    mockCurrent(currentComplete);
    await updateTask(userId, 't1', { isCompleted: true } as never);
    const update = vi.mocked(TaskModel.findOneAndUpdate).mock.calls[0]![1];
    expect(update).not.toHaveProperty('completedAt');
  });

  it('title-only update does NOT touch completedAt', async () => {
    mockCurrent(currentComplete);
    await updateTask(userId, 't1', { title: 'B' } as never);
    const update = vi.mocked(TaskModel.findOneAndUpdate).mock.calls[0]![1];
    expect(update).not.toHaveProperty('completedAt');
  });

  it('update 404s when the task is soft-deleted (findOne filter)', async () => {
    mockCurrent(null);
    await expect(updateTask(userId, 't1', { title: 'B' } as never)).rejects.toThrow(
      NotFoundError,
    );
    expect(TaskModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run to verify failure**

```bash
pnpm --filter @repo/server test -- task.service
```
Expected: FAIL — `createTask` never passes `completedAt`; `updateTask` doesn't call `findOne`.

- [x] **Step 3: Implement in `task.service.ts`**

`createTask` — the create call becomes:
```ts
const doc = await TaskModel.create({
  userId,
  title: dto.title,
  isCompleted: dto.isCompleted ?? false,
  completedAt: dto.isCompleted ? new Date() : null,
});
```

`updateTask` — replace the whole function:
```ts
export async function updateTask(
  userId: string,
  id: string,
  dto: UpdateTaskBodyDto,
): Promise<Task> {
  // Read-then-update so completedAt only moves on a real transition: a title
  // edit or a redundant isCompleted:true must not restart the 7-day cleanup
  // clock. ponytail: tiny race window between the two queries; an atomic
  // aggregation-pipeline update is the upgrade if it ever matters.
  const current = await TaskModel.findOne({ _id: id, userId, isDeleted: { $ne: true } }).lean();
  if (!current) throw new NotFoundError('Task not found');

  const update: Record<string, unknown> = { ...dto };
  if (dto.isCompleted === true && !current.isCompleted) update['completedAt'] = new Date();
  else if (dto.isCompleted === false && current.isCompleted) update['completedAt'] = null;

  const doc = await TaskModel.findOneAndUpdate({ _id: id, userId }, update, {
    returnDocument: 'after',
  }).lean();
  if (!doc) throw new NotFoundError('Task not found');

  logger.info(`Task updated: id=${id}`);
  await taskCache.invalidate(userId);
  return toTask(doc);
}
```

- [x] **Step 4: Run the full server suite — pass**

```bash
pnpm --filter @repo/server test
```
Expected: PASS (including the untouched cache/controller suites).

- [x] **Step 5: Commit**

```bash
git add apps/server/src/modules/task/task.service.ts apps/server/src/modules/task/task.service.test.ts
git commit -m "feat(server): completedAt stamps the false->true completion transition only"
```

---

### Task 4: `cleanupOldTasks()` — job logic + Redis lock

**Files:**
- Create: `apps/server/src/modules/task/task.cleanup.ts`
- Test: `apps/server/src/modules/task/task.cleanup.test.ts`

- [x] **Step 1: Write the failing tests**

Create `task.cleanup.test.ts`. Mock factories are self-contained (inline `vi.fn()` — no outer consts, no `vi.hoisted` needed; referencing an outer const from a factory throws a TDZ error):

```ts
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('./task.schema.ts', () => ({
  TaskModel: { distinct: vi.fn(), updateMany: vi.fn() },
}));
vi.mock('./task.cache.ts', () => ({ invalidate: vi.fn() }));
vi.mock('../../shared/config/redis.ts', () => ({ redis: { set: vi.fn() } }));
vi.mock('node-cron', () => ({ schedule: vi.fn(() => ({ stop: vi.fn() })) }));

import { TaskModel } from './task.schema.ts';
import * as taskCache from './task.cache.ts';
import { redis } from '../../shared/config/redis.ts';
import { schedule } from 'node-cron';
import { cleanupOldTasks, startTaskCleanup, stopTaskCleanup } from './task.cleanup.ts';

const NOW = new Date('2026-07-10T03:00:00Z');

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  // happy-path defaults; individual tests override
  vi.mocked(redis.set).mockResolvedValue('OK');
  vi.mocked(TaskModel.distinct).mockResolvedValue([]);
  vi.mocked(TaskModel.updateMany).mockResolvedValue({ modifiedCount: 0 } as never);
});
afterEach(() => vi.useRealTimers());

describe('cleanupOldTasks', () => {
  it('soft-deletes tasks completed before the 7-day cutoff', async () => {
    vi.mocked(TaskModel.updateMany).mockResolvedValue({ modifiedCount: 2 } as never);

    const count = await cleanupOldTasks();

    const cutoff = new Date('2026-07-03T03:00:00Z'); // NOW minus 7 days
    const expectedCriteria = {
      isCompleted: true,
      isDeleted: { $ne: true },
      completedAt: { $ne: null, $lt: cutoff },
    };
    expect(TaskModel.updateMany).toHaveBeenCalledWith(expectedCriteria, {
      isDeleted: true,
      deletedAt: expect.any(Date),
    });
    expect(count).toBe(2);
  });

  it('invalidates the cache of every affected user', async () => {
    vi.mocked(TaskModel.distinct).mockResolvedValue([
      { toString: () => 'u1' },
      { toString: () => 'u2' },
    ] as never);

    await cleanupOldTasks();

    expect(taskCache.invalidate).toHaveBeenCalledWith('u1');
    expect(taskCache.invalidate).toHaveBeenCalledWith('u2');
  });

  it('acquires the lock with SET NX PX and skips when another instance holds it', async () => {
    vi.mocked(redis.set).mockResolvedValue(null); // NX failed: key exists

    const count = await cleanupOldTasks();

    expect(redis.set).toHaveBeenCalledWith(
      'cron:task-cleanup',
      expect.any(String),
      'PX',
      600_000,
      'NX',
    );
    expect(TaskModel.updateMany).not.toHaveBeenCalled();
    expect(count).toBe(0);
  });

  it('runs anyway when Redis is down (idempotent job, best-effort lock)', async () => {
    vi.mocked(redis.set).mockRejectedValue(new Error('connection refused'));

    await cleanupOldTasks();

    expect(TaskModel.updateMany).toHaveBeenCalled();
  });
});

describe('cron wiring', () => {
  it('schedules the daily job at 03:00 and stop() stops it', () => {
    startTaskCleanup();
    expect(schedule).toHaveBeenCalledWith('0 3 * * *', expect.any(Function));

    const task = vi.mocked(schedule).mock.results[0]!.value;
    stopTaskCleanup();
    expect(task.stop).toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run to verify failure**

```bash
pnpm --filter @repo/server test -- task.cleanup
```
Expected: FAIL — module `./task.cleanup.ts` does not exist.

- [x] **Step 3: Create `task.cleanup.ts`**

```ts
import { schedule, type ScheduledTask } from 'node-cron';
import { subDays } from 'date-fns';
import { TaskModel } from './task.schema.ts';
import * as taskCache from './task.cache.ts';
import { redis } from '../../shared/config/redis.ts';
import { logger } from '../../shared/utils/logger.ts';

const LOCK_KEY = 'cron:task-cleanup';
const LOCK_TTL_MS = 600_000; // ~10 min: outlives any plausible run, dies with a crashed holder
const RETENTION_DAYS = 7;
const CRON_EXPRESSION = '0 3 * * *'; // daily 03:00, server TZ (UTC in the Docker image)

// Best-effort distributed lock. Every instance fires its own 3am cron; SET NX PX
// lets exactly one win. Deliberately never released — if the winner finished in
// 2s and deleted the key, a sibling whose cron fires at 3:00:05 would acquire it
// and run again. Letting the TTL expire IS the design, not a leak.
async function acquireLock(): Promise<boolean> {
  try {
    const result = await redis.set(LOCK_KEY, String(process.pid), 'PX', LOCK_TTL_MS, 'NX');
    return result === 'OK';
  } catch (err) {
    // Redis down: run anyway. The job is idempotent (the second run's criteria
    // match nothing), so a duplicate run is wasted work, not corruption. A
    // non-idempotent job (billing, email) should skip here instead.
    logger.warn(`[cleanup] lock unavailable, running unlocked: ${err}`);
    return true;
  }
}

export async function cleanupOldTasks(): Promise<number> {
  if (!(await acquireLock())) {
    logger.info('[cleanup] lock held by another instance, skipping run');
    return 0;
  }

  // Store absolute timestamps, compute relative windows at query time.
  const cutoff = subDays(new Date(), RETENTION_DAYS);
  const criteria = {
    isCompleted: true,
    isDeleted: { $ne: true },
    completedAt: { $ne: null, $lt: cutoff },
  };

  // Distinct userIds first: the updateMany bypasses the service layer, so we
  // must invalidate each affected user's cache ourselves or the web app keeps
  // serving "deleted" todos until the cache TTL expires.
  const userIds = await TaskModel.distinct('userId', criteria);
  const { modifiedCount } = await TaskModel.updateMany(criteria, {
    isDeleted: true,
    deletedAt: new Date(),
  });
  for (const uid of userIds) await taskCache.invalidate(uid.toString());

  // Log zero-runs too, so the job is observably alive.
  logger.info(
    `[cleanup] soft-deleted ${modifiedCount} task(s) completed before ${cutoff.toISOString()}`,
  );
  return modifiedCount;
}

let job: ScheduledTask | null = null;

export function startTaskCleanup(): void {
  job = schedule(CRON_EXPRESSION, () => {
    cleanupOldTasks().catch((err) => logger.error(`[cleanup] run failed: ${err}`));
  });
  logger.info('[cleanup] daily task-cleanup cron scheduled (03:00 server time)');
}

export function stopTaskCleanup(): void {
  job?.stop();
  job = null;
}
```

Note the **named** imports from `node-cron` — under `module: nodenext`, a default import of a CJS lib resolves to a non-constructable/non-callable namespace (TS2351/TS2339); named imports are the project rule.

- [x] **Step 4: Run tests — pass**

```bash
pnpm --filter @repo/server test -- task.cleanup
```
Expected: PASS (6 tests).

- [x] **Step 5: Commit**

```bash
git add apps/server/src/modules/task/task.cleanup.ts apps/server/src/modules/task/task.cleanup.test.ts
git commit -m "feat(server): nightly cleanup job soft-deletes week-old completed tasks (redis-locked)"
```

---

### Task 5: Boot/shutdown wiring in `index.ts`

**Files:**
- Modify: `apps/server/src/index.ts`

Cron registration lives in `index.ts` ONLY — `app.ts` must stay side-effect-free (Vitest imports it; same seam Redis/RabbitMQ use). No unit test for this glue; Task 7 verifies it live.

- [x] **Step 1: Wire start/stop**

```ts
import { startTaskCleanup, stopTaskCleanup } from './modules/task/task.cleanup.ts';
```

In `start()`, after `await connectRabbitMQ();`:
```ts
startTaskCleanup();
```

In the signal handler, before the `Promise.all` line:
```ts
stopTaskCleanup();
```

- [x] **Step 2: Typecheck + boot smoke**

```bash
pnpm --filter @repo/server typecheck
```
Expected: clean. Then boot the dev server (needs `docker compose up -d` for Mongo/Redis first):
```bash
pnpm --filter @repo/server dev
```
Expected in the log: `[cleanup] daily task-cleanup cron scheduled (03:00 server time)`. Ctrl-C: shuts down cleanly. (If :3000 is busy from an old tsx watcher, kill the *child* process too — see the welcome-mail journal.)

- [x] **Step 3: Commit**

```bash
git add apps/server/src/index.ts
git commit -m "feat(server): schedule task-cleanup cron on boot, stop on shutdown"
```

---

### Task 6: Backfill script (one-off) + run it

**Files:**
- Create: `apps/server/src/scripts/backfill-completed-at.ts`

- [x] **Step 1: Write the script**

```ts
// One-off backfill: tasks completed before completedAt existed get
// completedAt = updatedAt (fair proxy for when completion happened).
// Run manually:
//   pnpm --filter @repo/server exec tsx --env-file=.env/.env.dev src/scripts/backfill-completed-at.ts
// Idempotent: the filter only matches docs still missing completedAt, so a
// second run reports 0.
import mongoose from 'mongoose';
import { env } from '../shared/config/env.ts';
import { TaskModel } from '../modules/task/task.schema.ts';

await mongoose.connect(env.MONGODB_URI);

// Aggregation-pipeline update: only way to copy one field's value into another
// server-side. { timestamps: false } stops Mongoose bumping updatedAt mid-copy.
const { modifiedCount } = await TaskModel.updateMany(
  { isCompleted: true, completedAt: null }, // null matches missing fields too
  [{ $set: { completedAt: '$updatedAt' } }],
  { timestamps: false },
);

console.log(`backfilled completedAt on ${modifiedCount} task(s)`);
await mongoose.disconnect();
```

- [x] **Step 2: Run it against the dev DB (Mongo must be up: `docker compose up -d`)**

```bash
pnpm --filter @repo/server exec tsx --env-file=.env/.env.dev src/scripts/backfill-completed-at.ts
```
Expected: `backfilled completedAt on N task(s)` (N = however many completed tasks exist in dev).

- [x] **Step 3: Prove idempotence — run it again**

Same command. Expected: `backfilled completedAt on 0 task(s)`.

- [x] **Step 4: Typecheck + commit**

```bash
pnpm --filter @repo/server typecheck
git add apps/server/src/scripts/backfill-completed-at.ts
git commit -m "feat(server): one-off backfill of completedAt from updatedAt"
```

---

### Task 7: Live end-to-end verification

**Files:**
- Create (scratch, NOT committed): `apps/server/src/scripts/verify-cleanup.ts` — delete after the run

Unit tests proved the logic against mocks; this proves it against real Mongo + Redis. Uses a scratch script instead of the HTTP API to skip the auth-cookie dance — the read filter it asserts on is the exact query `getAllTasks` runs.

- [x] **Step 1: Scratch verification script**

```ts
import mongoose from 'mongoose';
import { env } from '../shared/config/env.ts';
import { TaskModel } from '../modules/task/task.schema.ts';
import { cleanupOldTasks } from '../modules/task/task.cleanup.ts';
import { subDays } from 'date-fns';

await mongoose.connect(env.MONGODB_URI);
const userId = new mongoose.Types.ObjectId();

// Seed: one task completed 8 days ago (should be swept), one completed
// yesterday (should survive), one incomplete (should survive).
const [old] = await TaskModel.create([
  { userId, title: 'old-completed', isCompleted: true, completedAt: subDays(new Date(), 8) },
  { userId, title: 'fresh-completed', isCompleted: true, completedAt: subDays(new Date(), 1) },
  { userId, title: 'incomplete', isCompleted: false },
]);

const swept = await cleanupOldTasks();

const visible = await TaskModel.find({ userId, isDeleted: { $ne: true } }).lean();
const oldDoc = await TaskModel.findById(old!._id).lean();

console.log(`swept=${swept} (>=1 expected)`);
console.log(`visible titles: ${visible.map((t) => t.title).join(', ')} (old-completed must be absent)`);
console.log(`old doc: isDeleted=${oldDoc!.isDeleted}, deletedAt=${oldDoc!.deletedAt?.toISOString()}`);

await TaskModel.deleteMany({ userId }); // clean up seed data
await mongoose.disconnect();
process.exit(0); // ioredis auto-reconnect keeps the loop alive otherwise
```

- [x] **Step 2: Run it (Mongo + Redis up via `docker compose up -d`)**

```bash
pnpm --filter @repo/server exec tsx --env-file=.env/.env.dev src/scripts/verify-cleanup.ts
```
Expected output:
- `swept=1` (or more, if real dev data also matched — fine)
- `visible titles: fresh-completed, incomplete` — no `old-completed`
- `old doc: isDeleted=true, deletedAt=<today's ISO timestamp>`

Also expected in the process log: `[cleanup] soft-deleted N task(s) completed before <cutoff>`.

- [x] **Step 3: Lock check (live Redis)**

Run the same script twice within 10 minutes. Second run expected: `[cleanup] lock held by another instance, skipping run` + `swept=0` — the NX lock from run 1 is still alive (not released by design). Then clear it so it doesn't surprise later testing:
```bash
docker compose exec redis redis-cli DEL cron:task-cleanup
```

- [x] **Step 4: Delete the scratch script**

```bash
rm apps/server/src/scripts/verify-cleanup.ts
```
Nothing to commit — record the observed output in the journal instead.

---

### Task 8: Docs + full gauntlet

**Files:**
- Modify: `apps/server/README.md`

- [x] **Step 1: README section**

Add a "Task cleanup (cron)" section to `apps/server/README.md` (pattern: the existing "Welcome mail (queue)" section) covering: the retention rule (completed + 7 days → soft delete), the daily `0 3 * * *` schedule (server TZ = UTC in Docker), the best-effort Redis lock (`cron:task-cleanup`, NX/PX, never released — TTL expiry is the design; Redis down ⇒ run anyway because the job is idempotent), the transition-only `completedAt` rule, the backfill script command, and the two deliberate gaps (no user-facing warning before disappearance; no second hard-delete retention tier — `deletedAt` is what that tier would query on).

- [x] **Step 2: Full gauntlet (mirrors CI — not a hand-picked subset)**

```bash
pnpm format:check && pnpm turbo run lint typecheck test
```
Expected: all green across web/server/shared. Fix anything red before committing (`pnpm format` for formatting).

- [x] **Step 3: Spot-check `git status` is clean of surprises, then commit**

```bash
git add apps/server/README.md
git commit -m "docs(server): document the task-cleanup cron + retention rationale"
```

---

## Verification summary

| Claim | Proven by |
| --- | --- |
| Reads exclude soft-deleted | Task 2 unit tests + Task 7 live `find` |
| `completedAt` transition-only | Task 3 unit tests (redundant-true + title-only cases) |
| 7-day cutoff math | Task 4 fake-timer test + Task 7 seeded 8-day/1-day tasks |
| Lock: one winner, TTL not released | Task 4 unit tests + Task 7 double-run against live Redis |
| Redis down ⇒ still runs | Task 4 unit test (rejected `set`) |
| Cache invalidated per user | Task 4 unit test |
| Cron registered/stopped | Task 5 boot log + clean Ctrl-C |
| Backfill idempotent | Task 6 second run = 0 |
| Nothing new leaks to the client | existing "never returns userId" out-DTO test (parse strips all non-contract fields) |

## Out of scope (per spec)

Restore endpoint, `completedAt` in the shared contract / UI warning, second hard-delete retention tier, swagger changes, web changes (e2e is network-mocked and response shapes are unchanged).
