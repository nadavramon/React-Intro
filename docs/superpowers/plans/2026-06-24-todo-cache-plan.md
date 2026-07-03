# Todo cache (Redis cache-aside) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Apply cache-aside (Redis/ioredis) to the Express server's `GET /tasks` so repeated per-user reads skip Mongo, with delete-on-write invalidation and a 60s TTL safety net.

**Architecture:** A shared singleton ioredis client (`src/shared/config/redis.ts`, mirroring `db.ts`) wired into boot/shutdown. A task-scoped cache helper (`src/modules/task/task.cache.ts`) owns the per-user key, TTL, JSON (de)serialization, hit/miss logging, and fail-open try/catch. `task.service.ts` orchestrates cache-aside: `getAllTasks` is the single cached primitive; `getTasksByStatus` derives its result in-memory; create/update/delete invalidate the user's key. Every cache call is fail-open — a down Redis falls through to Mongo, never erroring the endpoint.

**Tech Stack:** Express 5, Mongoose 9, ioredis, TypeScript (ESM, `.ts` import specifiers), Vitest, Docker Compose.

**Spec:** `docs/superpowers/specs/2026-06-24-todo-cache-design.md`

**Repo:** All paths below are in the **server** repo (`/Users/nadavramon/fullstack_projects/server`), not the React app. Commits + branch live there.

**Deviation from spec (approved in planning):** the cache helper lives at `src/modules/task/task.cache.ts` (co-located, follows the server's `<module>.<role>.ts` convention) instead of the spec's `src/shared/cache/taskCache.ts`. The generic ioredis client stays shared in `src/shared/config/redis.ts`.

---

## File Map

| Path | Action | Responsibility |
| --- | --- | --- |
| `package.json` / `package-lock.json` | Modify | Add `ioredis` dependency (clean lockfile regen). |
| `src/shared/config/env.ts` | Modify | Add `REDIS_URL` (soft, default `redis://localhost:6379`). |
| `src/shared/config/redis.ts` | Create | Singleton ioredis client + `connectRedis` / `disconnectRedis`, fail-open. |
| `src/index.ts` | Modify | Connect Redis at boot, disconnect on `SIGINT`/`SIGTERM`. |
| `src/modules/task/task.cache.ts` | Create | `read` / `write` / `invalidate` — key, TTL, serialize, log, fail-open. |
| `src/modules/task/task.cache.test.ts` | Create | Unit tests for the cache helper (mocked redis client). |
| `src/modules/task/task.service.ts` | Modify | Cache-aside read + derive filtered + invalidate on writes. |
| `src/modules/task/task.service.test.ts` | Create | Unit tests for cache-aside + invalidation (mocked Mongo + cache). |
| `docker-compose.yml` | Create | Redis-only local service. |
| `.env.example` | Modify | Document `REDIS_URL`. |

---

## Task 1: Add ioredis dependency + env + infra

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src/shared/config/env.ts`
- Create: `docker-compose.yml`
- Modify: `.env.example`

- [x] **Step 1: Add ioredis and regenerate the lockfile clean**

ioredis ships its own TypeScript types — no `@types/ioredis` needed. Per the npm-lockfile-drift lesson, regenerate clean so cross-platform optional peers aren't dropped (server uses native `bcrypt`; Linux CI runs `npm ci`).

```bash
cd /Users/nadavramon/fullstack_projects/server
npm install ioredis --save
rm -rf node_modules package-lock.json && npm install
```

Expected: `ioredis` appears under `dependencies` in `package.json`; `package-lock.json` regenerated with ioredis present.

- [x] **Step 2: Add REDIS_URL to env (soft — not requireEnv)**

Edit `src/shared/config/env.ts`, add the last property so a missing Redis never `process.exit(1)`:

```ts
export const env = {
  JWT_SECRET: requireEnv('JWT_SECRET'),
  REFRESH_TOKEN_SECRET: requireEnv('REFRESH_TOKEN_SECRET'),
  MONGODB_URI: requireEnv('MONGODB_URI'),
  PORT: process.env.PORT,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
};
```

- [x] **Step 3: Create docker-compose.yml (Redis only)**

Create `docker-compose.yml` at the server repo root:

```yaml
services:
  redis:
    image: redis:7-alpine
    ports:
      - '6379:6379'
    volumes:
      - redis-data:/data
volumes:
  redis-data:
```

- [x] **Step 4: Document REDIS_URL in .env.example**

Append to `.env.example`:

```
REDIS_URL=redis://localhost:6379
```

- [x] **Step 5: Create branch and commit**

```bash
cd /Users/nadavramon/fullstack_projects/server
git checkout -b feat/tasks-cache
git add package.json package-lock.json src/shared/config/env.ts docker-compose.yml .env.example
git commit -m "chore(cache): add ioredis dep, REDIS_URL env, redis compose service"
```

---

## Task 2: Shared Redis client + boot/shutdown wiring

**Files:**
- Create: `src/shared/config/redis.ts`
- Modify: `src/index.ts`

- [x] **Step 1: Create the redis client module**

Create `src/shared/config/redis.ts`. `lazyConnect` lets us control connect; `enableOfflineQueue: false` + `maxRetriesPerRequest: 1` make commands reject fast (not hang) when Redis is down, which is what powers fail-open downstream.

```ts
import Redis from 'ioredis';
import { env } from './env.ts';
import { logger } from '../utils/logger.ts';

export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableOfflineQueue: false,
  maxRetriesPerRequest: 1,
});

redis.on('error', (err) => logger.warn(`[cache] redis error: ${err.message}`));

export async function connectRedis(): Promise<void> {
  try {
    await redis.connect();
    logger.info('Connected to Redis');
  } catch (err) {
    logger.warn(`[cache] Redis unavailable, running without cache: ${err}`);
  }
}

export async function disconnectRedis(): Promise<void> {
  redis.disconnect();
  logger.info('Disconnected from Redis');
}
```

- [x] **Step 2: Wire into boot + graceful shutdown**

Edit `src/index.ts`. Add the import, call `connectRedis()` after `connectDB()`, and disconnect both on signal:

```ts
import { connectDB, disconnectDB } from './shared/config/db.ts';
import { connectRedis, disconnectRedis } from './shared/config/redis.ts';
```

```ts
  await connectDB();
  await connectRedis();
  for (const sig of ['SIGINT', 'SIGTERM'] as const) {
    process.on(sig, async () => {
      logger.info(`${sig} received, shutting down`);
      await Promise.all([disconnectDB(), disconnectRedis()]);
      process.exit(0);
    });
  }
```

- [x] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no type errors).

- [x] **Step 4: Commit**

```bash
git add src/shared/config/redis.ts src/index.ts
git commit -m "feat(cache): add shared ioredis client with fail-open boot/shutdown"
```

---

## Task 3: Task cache helper (TDD)

**Files:**
- Create: `src/modules/task/task.cache.ts`
- Test: `src/modules/task/task.cache.test.ts`

- [x] **Step 1: Write the failing test**

Create `src/modules/task/task.cache.test.ts`. Mocks the shared client so no live Redis is needed; asserts the key scheme, the 60s TTL, and fail-open behavior on each operation.

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../shared/config/redis.ts', () => ({
  redis: { get: vi.fn(), set: vi.fn(), del: vi.fn() },
}));

import { redis } from '../../shared/config/redis.ts';
import { read, write, invalidate } from './task.cache.ts';

const userId = 'user-1';
const key = 'tasks:user:user-1';
const tasks = [{ id: 't1', userId, title: 'A', isCompleted: false }];

beforeEach(() => vi.clearAllMocks());

describe('task.cache read', () => {
  it('returns parsed tasks on hit', async () => {
    vi.mocked(redis.get).mockResolvedValue(JSON.stringify(tasks));
    expect(await read(userId)).toEqual(tasks);
    expect(redis.get).toHaveBeenCalledWith(key);
  });

  it('returns null on miss', async () => {
    vi.mocked(redis.get).mockResolvedValue(null);
    expect(await read(userId)).toBeNull();
  });

  it('fails open to null when redis throws', async () => {
    vi.mocked(redis.get).mockRejectedValue(new Error('down'));
    expect(await read(userId)).toBeNull();
  });
});

describe('task.cache write', () => {
  it('sets the key with a 60s TTL', async () => {
    vi.mocked(redis.set).mockResolvedValue('OK');
    await write(userId, tasks);
    expect(redis.set).toHaveBeenCalledWith(key, JSON.stringify(tasks), 'EX', 60);
  });

  it('swallows redis errors', async () => {
    vi.mocked(redis.set).mockRejectedValue(new Error('down'));
    await expect(write(userId, tasks)).resolves.toBeUndefined();
  });
});

describe('task.cache invalidate', () => {
  it('deletes the user key', async () => {
    vi.mocked(redis.del).mockResolvedValue(1);
    await invalidate(userId);
    expect(redis.del).toHaveBeenCalledWith(key);
  });

  it('swallows redis errors', async () => {
    vi.mocked(redis.del).mockRejectedValue(new Error('down'));
    await expect(invalidate(userId)).resolves.toBeUndefined();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/task/task.cache.test.ts`
Expected: FAIL — `task.cache.ts` does not exist / exports undefined.

- [x] **Step 3: Implement the cache helper**

Create `src/modules/task/task.cache.ts`. `read` returns `null` on both miss and error so the service treats it identically (go to Mongo). `write`/`invalidate` swallow errors.

```ts
import { redis } from '../../shared/config/redis.ts';
import { logger } from '../../shared/utils/logger.ts';
import { TaskEntity } from './task.entity.ts';

const TTL_SECONDS = 60;

function keyFor(userId: string): string {
  return `tasks:user:${userId}`;
}

export async function read(userId: string): Promise<TaskEntity[] | null> {
  try {
    const cached = await redis.get(keyFor(userId));
    if (cached === null) {
      logger.info(`[cache] MISS tasks user=${userId}`);
      return null;
    }
    logger.info(`[cache] HIT tasks user=${userId}`);
    return JSON.parse(cached) as TaskEntity[];
  } catch (err) {
    logger.warn(`[cache] read failed user=${userId}: ${err}`);
    return null;
  }
}

export async function write(userId: string, tasks: TaskEntity[]): Promise<void> {
  try {
    await redis.set(keyFor(userId), JSON.stringify(tasks), 'EX', TTL_SECONDS);
  } catch (err) {
    logger.warn(`[cache] write failed user=${userId}: ${err}`);
  }
}

export async function invalidate(userId: string): Promise<void> {
  try {
    await redis.del(keyFor(userId));
    logger.info(`[cache] INVALIDATE tasks user=${userId}`);
  } catch (err) {
    logger.warn(`[cache] invalidate failed user=${userId}: ${err}`);
  }
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/task/task.cache.test.ts`
Expected: PASS (7 tests).

- [x] **Step 5: Commit**

```bash
git add src/modules/task/task.cache.ts src/modules/task/task.cache.test.ts
git commit -m "feat(cache): add task cache helper (key, 60s TTL, fail-open)"
```

---

## Task 4: Cache-aside read path in task.service (TDD)

**Files:**
- Modify: `src/modules/task/task.service.ts`
- Test: `src/modules/task/task.service.test.ts`

- [x] **Step 1: Write the failing test**

Create `src/modules/task/task.service.test.ts`. Mocks both the Mongo model and the cache helper so the test asserts the cache-aside wiring only. (First service-level test in the repo — establishes the mongoose-mock pattern.)

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./task.schema.ts', () => ({
  TaskModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
}));

vi.mock('./task.cache.ts', () => ({
  read: vi.fn(),
  write: vi.fn(),
  invalidate: vi.fn(),
}));

import { TaskModel } from './task.schema.ts';
import * as taskCache from './task.cache.ts';
import { getAllTasks, getTasksByStatus } from './task.service.ts';

const userId = 'user-1';
const docA = {
  _id: { toString: () => 't1' },
  userId: { toString: () => userId },
  title: 'A',
  isCompleted: false,
};
const entityA = { id: 't1', userId, title: 'A', isCompleted: false };
const entityDone = { id: 't2', userId, title: 'B', isCompleted: true };

beforeEach(() => vi.clearAllMocks());

describe('getAllTasks cache-aside', () => {
  it('returns cached tasks without hitting Mongo on hit', async () => {
    vi.mocked(taskCache.read).mockResolvedValue([entityA]);
    const result = await getAllTasks(userId);
    expect(result).toEqual([entityA]);
    expect(TaskModel.find).not.toHaveBeenCalled();
    expect(taskCache.write).not.toHaveBeenCalled();
  });

  it('queries Mongo and writes cache on miss', async () => {
    vi.mocked(taskCache.read).mockResolvedValue(null);
    vi.mocked(TaskModel.find).mockReturnValue({
      lean: () => Promise.resolve([docA]),
    } as never);
    const result = await getAllTasks(userId);
    expect(result).toEqual([entityA]);
    expect(TaskModel.find).toHaveBeenCalledWith({ userId });
    expect(taskCache.write).toHaveBeenCalledWith(userId, [entityA]);
  });
});

describe('getTasksByStatus derives from the cached list', () => {
  it('filters the cached list in memory without a status query', async () => {
    vi.mocked(taskCache.read).mockResolvedValue([entityA, entityDone]);
    const result = await getTasksByStatus(userId, true);
    expect(result).toEqual([entityDone]);
    expect(TaskModel.find).not.toHaveBeenCalled();
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/task/task.service.test.ts`
Expected: FAIL — `getAllTasks` still queries Mongo unconditionally (no `taskCache` import yet).

- [x] **Step 3: Implement cache-aside in the service**

Edit `src/modules/task/task.service.ts`. Add the import near the top:

```ts
import * as taskCache from './task.cache.ts';
```

Replace `getAllTasks` and `getTasksByStatus` with:

```ts
export async function getAllTasks(userId: string): Promise<TaskEntity[]> {
  const cached = await taskCache.read(userId);
  if (cached !== null) return cached;

  const docs = await TaskModel.find({ userId }).lean();
  const tasks = docs.map(toTask);
  await taskCache.write(userId, tasks);
  return tasks;
}

export async function getTasksByStatus(
  userId: string,
  isCompleted: boolean,
): Promise<TaskEntity[]> {
  const tasks = await getAllTasks(userId);
  return tasks.filter((t) => t.isCompleted === isCompleted);
}
```

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/task/task.service.test.ts`
Expected: PASS (3 tests).

- [x] **Step 5: Commit**

```bash
git add src/modules/task/task.service.ts src/modules/task/task.service.test.ts
git commit -m "feat(cache): cache-aside read path for tasks; derive filtered list from cache"
```

---

## Task 5: Invalidate cache on writes (TDD)

**Files:**
- Modify: `src/modules/task/task.service.ts`
- Test: `src/modules/task/task.service.test.ts`

- [x] **Step 1: Add failing invalidation tests**

Append to `src/modules/task/task.service.test.ts`. Add the three mutation functions to the import line:

```ts
import {
  getAllTasks,
  getTasksByStatus,
  createTask,
  updateTask,
  deleteTask,
} from './task.service.ts';
```

Then add:

```ts
describe('writes invalidate the user cache', () => {
  it('createTask invalidates after a successful insert', async () => {
    vi.mocked(TaskModel.create).mockResolvedValue({ toObject: () => docA } as never);
    await createTask(userId, { title: 'A' } as never);
    expect(taskCache.invalidate).toHaveBeenCalledWith(userId);
  });

  it('updateTask invalidates after a successful update', async () => {
    vi.mocked(TaskModel.findOneAndUpdate).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);
    await updateTask(userId, 't1', { title: 'B' } as never);
    expect(taskCache.invalidate).toHaveBeenCalledWith(userId);
  });

  it('deleteTask invalidates after a successful delete', async () => {
    vi.mocked(TaskModel.findOneAndDelete).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);
    await deleteTask(userId, 't1');
    expect(taskCache.invalidate).toHaveBeenCalledWith(userId);
  });
});
```

- [x] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/modules/task/task.service.test.ts`
Expected: FAIL — the three new tests fail (`invalidate` not called).

- [x] **Step 3: Add invalidation to each mutation**

Edit `src/modules/task/task.service.ts`. In `createTask`, after `logger.info(...)` and before `return task;`:

```ts
  await taskCache.invalidate(userId);
```

In `updateTask`, after `logger.info(...)` and before `return toTask(doc);`:

```ts
  await taskCache.invalidate(userId);
```

In `deleteTask`, after `logger.info(...)` (end of function):

```ts
  await taskCache.invalidate(userId);
```

Each sits *after* the successful Mongo write (and after the `NotFoundError` guard in update/delete), so a failed/not-found mutation never invalidates.

- [x] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/modules/task/task.service.test.ts`
Expected: PASS (6 tests).

- [x] **Step 5: Commit**

```bash
git add src/modules/task/task.service.ts src/modules/task/task.service.test.ts
git commit -m "feat(cache): invalidate user task cache on create/update/delete"
```

---

## Task 6: Full check gauntlet + manual smoke

**Files:** none (verification only)

- [x] **Step 1: Run the server's full check gauntlet (mirrors CI)**

```bash
cd /Users/nadavramon/fullstack_projects/server
npm run format:check && npm run typecheck && npm test
```

Expected: format clean, no type errors, all tests pass (including the 13 new cache tests). If `format:check` fails, run `npm run format` and amend.

- [x] **Step 2: Manual smoke — observe hit/miss/invalidate**

Start Redis and the dev server (two terminals):

```bash
cd /Users/nadavramon/fullstack_projects/server
docker compose up -d redis
npm run dev
```

Get a token, then watch the server log while exercising the endpoint:

```bash
TOKEN=$(curl -s localhost:3000/auth/login -H 'content-type: application/json' \
  -d '{"email":"<dev-email>","password":"<dev-password>"}' | npx --yes json id .accessToken 2>/dev/null || true)
# First GET → MISS, second GET → HIT
curl -s localhost:3000/tasks -H "authorization: Bearer $TOKEN" > /dev/null
curl -s localhost:3000/tasks -H "authorization: Bearer $TOKEN" > /dev/null
# Mutating → INVALIDATE; next GET → MISS again
curl -s localhost:3000/tasks -X POST -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' -d '{"title":"smoke"}' > /dev/null
curl -s localhost:3000/tasks -H "authorization: Bearer $TOKEN" > /dev/null
```

Expected server log sequence:
`[cache] MISS` → `[cache] HIT` → `[cache] INVALIDATE` → `[cache] MISS`.
(Use the dev credentials from `.env/.env.dev`.) Hit ratio = HIT / (HIT + MISS) via `grep '\[cache\]'`.

- [x] **Step 3: Verify fail-open (cache optional)**

```bash
docker compose stop redis
curl -s localhost:3000/tasks -H "authorization: Bearer $TOKEN"
```

Expected: tasks still return (200); server logs a `[cache] ... failed` warning but does **not** error. Restart with `docker compose start redis`.

- [x] **Step 4: Push and open PR**

```bash
git push -u origin feat/tasks-cache
gh pr create --title "feat(cache): Redis cache-aside on GET /tasks" --body-file <(cat <<'EOF'
Applies cache-aside (ioredis) to `GET /tasks`.

- Shared singleton ioredis client wired into boot/shutdown (fail-open).
- One cached primitive per user (`tasks:user:<id>`), 60s TTL; filtered `?isCompleted=` derived in-memory.
- create/update/delete invalidate the user's key (delete-on-write).
- Redis-only `docker-compose.yml`; soft `REDIS_URL`.
- 13 unit tests (cache helper + service), mocked Redis + Mongo — no live Redis in CI.
EOF
)
```

(PR body follows the no-test-plan / no-attribution preference. Nadav merges himself.)

---

## Self-Review

- **Spec coverage:** ioredis client (T2) ✓; cache-aside read + hit/miss (T3–T4) ✓; per-user key (T3) ✓; 60s TTL (T3) ✓; derive filtered in-app (T4) ✓; invalidate on POST/PUT/DELETE (T5) ✓; hit/miss/invalidate logging (T3) ✓; fail-open (T2 client opts + T3 helper) ✓; docker-compose Redis-only (T1) ✓; soft REDIS_URL (T1) ✓; Vitest mocked tests incl. per-user isolation via distinct keys (T3/T4) ✓. The spec's Concepts section is documentation, no task needed. *Note:* server uses PUT not PATCH for updates (PATCH from the spec's prose isn't a real route) — invalidation covers the actual create/update(PUT)/delete handlers.
- **Placeholders:** none — every code/test step shows full code; the only literal placeholders are the `<dev-email>`/`<dev-password>` in the manual smoke, which are genuine local secrets, not plan gaps.
- **Type consistency:** `read`/`write`/`invalidate` signatures match between `task.cache.ts`, its test, and the service mock; `TaskEntity` shape (`id`/`userId`/`title`/`isCompleted`) consistent throughout; `toTask` reused, not redefined.
- **Equipment tags:** none added — every task is standard TDD on the default general-purpose agent; no specialized skill earns its keep here.
