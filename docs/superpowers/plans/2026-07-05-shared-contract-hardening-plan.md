# Shared Contract Hardening — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enforce response DTOs so DB-internal fields (`userId`) can't leak over HTTP, and move shared *code* (a title-length constant, an error-response schema) into `@repo/shared`.

**Architecture:** `taskSchema.parse()` at the service boundary makes the out-DTO real (strips extra fields + throws on malformed) — symmetric with `validate()` on the in side. Two new shared modules (`constants.ts`, `error.ts`) give both apps one source for the title limit and one agreed failure shape; the web gets a typed `parseApiError` that surfaces server messages with a safe fallback.

**Tech Stack:** zod v4, TypeScript (nodenext server / bundler web), Vitest, Express 5, Turborepo.

**Branch & PR discipline:** all work stays on **`feat/shared-contract-hardening`** (already carries the spec commit `baa2c72`). Commit each task locally. **Do NOT push or open a PR until the entire pipeline is done** — one PR at the end.

**Scope guardrail:** `packages/shared/**`, `apps/server/src/modules/task/**`, `apps/server/src/shared/middlewares/errorHandler.ts`, `apps/web/src/lib/errors.ts`, `apps/web/src/features/todo/{store/todoStore.ts,components/AddTaskForm/AddTaskForm.tsx}`. **No auth / better-auth files.**

---

## File map

**Created:** `packages/shared/src/constants.ts`, `packages/shared/src/error.ts`, `packages/shared/src/error.test.ts`, `apps/web/src/lib/errors.ts`, `apps/web/src/lib/errors.test.ts`.
**Modified:** `packages/shared/src/task.ts` (use constants), `packages/shared/src/index.ts` (export new modules), `packages/shared/src/task.test.ts` (strip test), `apps/server/src/modules/task/task.service.ts` (out-DTO via parse), `apps/server/src/modules/task/task.cache.ts` (`Task[]` types), `apps/server/src/modules/task/task.service.test.ts` (no-userId assertion), `apps/server/src/shared/middlewares/errorHandler.ts` (typed `ApiError`), `apps/web/src/features/todo/store/todoStore.ts` (parseApiError), `apps/web/src/features/todo/components/AddTaskForm/AddTaskForm.tsx` (maxLength + server toast).
**Deleted:** `apps/server/src/modules/task/task.entity.ts` (unused once the service returns `Task`).

---

### Task 1: Shared — constants + error schema + wire task.ts

**Files:**
- Create: `packages/shared/src/constants.ts`, `packages/shared/src/error.ts`, `packages/shared/src/error.test.ts`
- Modify: `packages/shared/src/task.ts`, `packages/shared/src/index.ts`, `packages/shared/src/task.test.ts`

- [ ] **Step 1: Create `packages/shared/src/constants.ts`**

```ts
export const TASK_TITLE_MIN_LENGTH = 1
export const TASK_TITLE_MAX_LENGTH = 255
```

- [ ] **Step 2: Create `packages/shared/src/error.ts`**

```ts
import { z } from 'zod'

/** The shape every API error response takes. Success shapes have their own
 *  schemas (taskSchema, etc.); this is the agreed *failure* envelope. */
export const errorResponseSchema = z.object({ error: z.string() })
export type ApiError = z.infer<typeof errorResponseSchema>
```

- [ ] **Step 3: Wire the constants into `packages/shared/src/task.ts`**

Replace the two hardcoded lengths in both `createTaskBodySchema` and `updateTaskBodySchema`. Add the import at the top, then use the constants:

```ts
import { z } from 'zod'
import { TASK_TITLE_MIN_LENGTH, TASK_TITLE_MAX_LENGTH } from './constants.ts'
```

In each schema the `title` field becomes:

```ts
    title: z
      .string({ error: 'Title must be a string' })
      .trim()
      .min(TASK_TITLE_MIN_LENGTH, 'Title must be a non-empty string')
      .max(TASK_TITLE_MAX_LENGTH, `Title is too long (maximum ${TASK_TITLE_MAX_LENGTH} characters)`),
```
(In `updateTaskBodySchema` this `title` is followed by `.optional()`, exactly as today — keep that.)

- [ ] **Step 4: Export the new modules from `packages/shared/src/index.ts`**

```ts
export * from './task.ts'
export * from './user.ts'
export * from './constants.ts'
export * from './error.ts'
```

- [ ] **Step 5: Write the failing tests — the out-DTO strip + error schema**

Append to `packages/shared/src/task.test.ts` (inside the existing `taskSchema` describe or a new one):

```ts
describe('taskSchema — out-DTO enforcement', () => {
  it('strips DB-internal fields (userId) that are not in the contract', () => {
    const parsed = taskSchema.parse({ id: '1', userId: 'secret-owner', title: 'x', isCompleted: false })
    expect(parsed).toEqual({ id: '1', title: 'x', isCompleted: false })
    expect(parsed).not.toHaveProperty('userId')
  })
})
```

Create `packages/shared/src/error.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { errorResponseSchema } from './error.ts'

describe('errorResponseSchema', () => {
  it('accepts a string error', () => {
    expect(errorResponseSchema.parse({ error: 'boom' })).toEqual({ error: 'boom' })
  })
  it('rejects a missing or non-string error', () => {
    expect(() => errorResponseSchema.parse({})).toThrow()
    expect(() => errorResponseSchema.parse({ error: 123 })).toThrow()
  })
})
```

- [ ] **Step 6: Run the shared tests — expect PASS (schemas already support this)**

Run: `pnpm --filter @repo/shared test`
Expected: all pass (the strip test passes because zod object schemas strip unknown keys by default; the constant wiring didn't change the schema shape).

- [ ] **Step 7: Build shared so downstream packages see the new exports**

Run: `pnpm --filter @repo/shared build`
Expected: `packages/shared/dist` includes `constants.js/.d.ts` and `error.js/.d.ts`.

- [ ] **Step 8: Commit (local only — no push)**

```bash
pnpm --filter @repo/shared exec prettier --write "src/**/*.ts"
git add packages/shared
git commit -m "feat(shared): title-length constants + error-response schema; out-DTO strip test"
```

---

### Task 2: Server — enforce the out-DTO in the task service

**Files:**
- Modify: `apps/server/src/modules/task/task.service.ts`, `apps/server/src/modules/task/task.cache.ts`, `apps/server/src/modules/task/task.service.test.ts`
- Delete: `apps/server/src/modules/task/task.entity.ts`

- [ ] **Step 1: Add the failing assertion to `task.service.test.ts`**

The existing suite mocks `TaskModel` + `task.cache` and its `docA`/`docB` fixtures include a `userId`. Add a test asserting the mapped result no longer carries it (put it after the existing `getAllTasks` tests):

```ts
it('never returns userId on task objects (out-DTO enforced)', async () => {
  vi.mocked(taskCache.read).mockResolvedValue(null)
  vi.mocked(TaskModel.find).mockReturnValue({
    lean: () => Promise.resolve([docA]),
  } as never)

  const tasks = await getAllTasks(userId)

  expect(tasks[0]).not.toHaveProperty('userId')
  expect(tasks[0]).toEqual({ id: 't1', title: docA.title, isCompleted: docA.isCompleted })
})
```
(Match `docA`'s actual `title`/`isCompleted` values from the top of the file; if the fixture lacks a `userId`, add one to `docA` so the test is meaningful.)

- [ ] **Step 2: Run it — expect FAIL (service still returns userId)**

Run: `pnpm --filter @repo/server test -- task.service`
Expected: FAIL on `not.toHaveProperty('userId')`.

- [ ] **Step 3: Rewrite `toTask` to return the shared `Task` via `taskSchema.parse`**

In `apps/server/src/modules/task/task.service.ts`, replace the `TaskEntity` import and `toTask`, and swap every `TaskEntity` return type for `Task`:

```ts
import { Task, taskSchema } from '@repo/shared';
import { TaskModel, TaskDoc } from './task.schema.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
import { CreateTaskBodyDto, UpdateTaskBodyDto } from './task.dto.ts';
import { logger } from '../../shared/utils/logger.ts';
import * as taskCache from './task.cache.ts';

// Project the DB doc through the shared out-schema. parse() strips anything
// not in the contract (so userId can never reach the client) and throws if the
// server ever produces a malformed shape. Symmetric with validate() on the in side.
function toTask(doc: TaskDoc): Task {
  return taskSchema.parse({
    id: doc._id.toString(),
    title: doc.title,
    isCompleted: doc.isCompleted,
  });
}
```

Then change the six signatures: `Promise<TaskEntity[]>` → `Promise<Task[]>` (getAllTasks, getTasksByStatus) and `Promise<TaskEntity>` → `Promise<Task>` (getTaskById, createTask, updateTask). No other logic changes.

- [ ] **Step 4: Update `task.cache.ts` to cache `Task[]` (drops userId from the cache too)**

Replace the `TaskEntity` import + the two type references:

```ts
import { redis } from '../../shared/config/redis.ts';
import { logger } from '../../shared/utils/logger.ts';
import { Task } from '@repo/shared';
```
Then `Promise<TaskEntity[] | null>` → `Promise<Task[] | null>`, `as TaskEntity[]` → `as Task[]`, and `tasks: TaskEntity[]` → `tasks: Task[]`.

- [ ] **Step 5: Delete the now-unused entity**

```bash
git rm apps/server/src/modules/task/task.entity.ts
```
(Confirm no remaining importers: `grep -rn TaskEntity apps/server/src` should return nothing.)

- [ ] **Step 6: Run server tests — expect PASS**

Run: `pnpm --filter @repo/server test`
Expected: the new assertion passes; `task.cache.test` and the rest stay green.

- [ ] **Step 7: Typecheck the server**

Run: `pnpm --filter @repo/server typecheck`
Expected: exit 0 (no dangling `TaskEntity` references).

- [ ] **Step 8: Commit (local only)**

```bash
pnpm --filter @repo/server format
git add apps/server/src/modules/task
git commit -m "feat(server): enforce Task out-DTO via taskSchema.parse; drop TaskEntity"
```

---

### Task 3: Server — type the error payload as `ApiError`

**Files:**
- Modify: `apps/server/src/shared/middlewares/errorHandler.ts`

- [ ] **Step 1: Type the payload against the shared envelope**

In `apps/server/src/shared/middlewares/errorHandler.ts`, import `ApiError` and type the payload so the guaranteed shape is `{ error }` (the dev-only `stack` is an explicit extra):

```ts
import { ApiError } from '@repo/shared';
```
Replace the payload construction:

```ts
  const payload: ApiError & { stack?: string } = { error: message };

  if (process.env.NODE_ENV === 'development') {
    payload.stack = err.stack;
  }

  res.status(statusCode).json(payload);
```
(Everything above — the 11000 remap, statusCode/message derivation, logging — is unchanged.)

- [ ] **Step 2: Typecheck + tests**

Run: `pnpm --filter @repo/server typecheck && pnpm --filter @repo/server test`
Expected: green (pure type-alignment; runtime behavior identical).

- [ ] **Step 3: Commit (local only)**

```bash
pnpm --filter @repo/server format
git add apps/server/src/shared/middlewares/errorHandler.ts
git commit -m "refactor(server): type error payload as shared ApiError"
```

---

### Task 4: Web — parseApiError, surface server messages, input maxLength

**Files:**
- Create: `apps/web/src/lib/errors.ts`, `apps/web/src/lib/errors.test.ts`
- Modify: `apps/web/src/features/todo/store/todoStore.ts`, `apps/web/src/features/todo/components/AddTaskForm/AddTaskForm.tsx`

- [ ] **Step 1: Write the failing test `apps/web/src/lib/errors.test.ts`**

```ts
import { describe, it, expect } from 'vitest'
import { AxiosError } from 'axios'
import { parseApiError } from './errors'

describe('parseApiError', () => {
  it('returns the server message from a well-formed axios error body', () => {
    const err = new AxiosError('Request failed', 'ERR', undefined, undefined, {
      data: { error: 'Title is too long' },
    } as never)
    expect(parseApiError(err, 'fallback')).toBe('Title is too long')
  })

  it('returns the fallback for a malformed body', () => {
    const err = new AxiosError('Request failed', 'ERR', undefined, undefined, {
      data: { nope: true },
    } as never)
    expect(parseApiError(err, 'fallback')).toBe('fallback')
  })

  it('returns the fallback for a non-axios error', () => {
    expect(parseApiError(new Error('boom'), 'fallback')).toBe('fallback')
  })
})
```

- [ ] **Step 2: Run it — expect FAIL (module not found)**

Run: `pnpm --filter @repo/web test -- errors`
Expected: FAIL — `parseApiError` / `./errors` doesn't exist yet.

- [ ] **Step 3: Implement `apps/web/src/lib/errors.ts`**

```ts
import { isAxiosError } from 'axios'
import { errorResponseSchema } from '@repo/shared'

// Safely pull the server's error message off a failed request, falling back to
// a friendly message for network errors / opaque bodies / non-axios throws.
export function parseApiError(err: unknown, fallback: string): string {
  if (isAxiosError(err)) {
    const parsed = errorResponseSchema.safeParse(err.response?.data)
    if (parsed.success) return parsed.data.error
  }
  return fallback
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `pnpm --filter @repo/web test -- errors`
Expected: 3 passing.

- [ ] **Step 5: Surface server messages in `todoStore.ts`**

Add the import and use `parseApiError` in the `init` catch (the one that sets `errorMessage`):

```ts
import { parseApiError } from '@/lib/errors'
```
```ts
        } catch (err) {
            console.error('Failed to load tasks', err)
            set({
                status: TodoStatus.Error,
                errorMessage: parseApiError(err, 'Could not load tasks. Please try again.'),
            })
        }
```
(The add/toggle/delete catches rethrow to components — leave them; the AddTaskForm one is handled in Step 6.)

- [ ] **Step 6: `AddTaskForm.tsx` — input maxLength + surface server message on add**

Add the constant import and the maxLength attribute; bind `err` in the catch and surface it:

```ts
import { TASK_TITLE_MAX_LENGTH } from '@repo/shared'
import { parseApiError } from '@/lib/errors'
```
Input gains `maxLength={TASK_TITLE_MAX_LENGTH}` alongside the existing attributes. The catch becomes:

```ts
        } catch (err) {
            toast.error(parseApiError(err, 'Failed to add task'))
        }
```

- [ ] **Step 7: Typecheck + web tests + a smoke of the todo unit tests**

Run: `pnpm --filter @repo/web typecheck && pnpm --filter @repo/web test`
Expected: green — `errors.test`, the existing `todoStore.test`, and RTL component tests all pass (behavior for existing tests is unchanged; only the error *text source* moved).

- [ ] **Step 8: Commit (local only)**

```bash
pnpm --filter @repo/web format
git add apps/web/src/lib/errors.ts apps/web/src/lib/errors.test.ts apps/web/src/features/todo
git commit -m "feat(web): parseApiError surfaces server messages; title maxLength from shared"
```

---

### Task 5: Full verification (mirror CI) — no push yet

**Files:** none (verification + final local commit if formatting shifts)

- [ ] **Step 1: Clean whole-repo gauntlet**

Run: `pnpm format:check && pnpm turbo run lint typecheck test build`
Expected: format clean; all packages green (shared builds first). If `format:check` flags anything, run `pnpm format`, re-check, and `git commit -am "chore: format"`.

- [ ] **Step 2: Prove the leak is closed at the HTTP layer (fast, no Mongo)**

Reuse the app-boot smoke from the monorepo work: build, boot the compiled `app.js` with dummy env, and assert `GET /api/tasks` is auth-gated (401) — i.e. no unauthenticated leak. (Full authenticated end-to-end needs a live session + Mongo; the shared strip test + service test already prove `userId` can't appear in a task object.)

Run: `pnpm --filter @repo/server build && pnpm --filter @repo/shared build`
Expected: both build clean. Note in the digest that the unit-level tests (shared strip + service no-userId) are the authoritative proof.

- [ ] **Step 3: Confirm branch state — everything committed, nothing pushed**

Run: `git log --oneline main..HEAD && git status --short`
Expected: the spec commit + the four task commits present; clean working tree; branch has **no upstream** (push happens once, after this plan, at the end of the pipeline).

---

## Self-review notes

- **Spec coverage:** out-DTO enforcement (T2) ✓; strip test proving userId can't recur (T1) ✓; `TASK_TITLE_MAX_LENGTH` in shared + used by schemas & web input (T1, T4) ✓; `errorResponseSchema`/`ApiError` (T1) + server typed (T3) + web `parseApiError` with fallback (T4) ✓; `GetTasksQuerySchema` left server-side ✓; no auth files touched ✓.
- **Type consistency:** `toTask(): Task`, service returns `Task[]`/`Task`, cache `Task[]`, `errorResponseSchema`/`ApiError`, `parseApiError(err, fallback): string` — referenced identically across tasks.
- **Ordering:** shared (foundation, built) → server consumers → web consumers → verify. Each task self-contained and committed.
- **Branch/PR:** all local on `feat/shared-contract-hardening`; **one PR at the very end of the pipeline**, never per-task.
