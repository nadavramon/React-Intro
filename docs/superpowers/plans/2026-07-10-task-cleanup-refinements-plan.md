# Task-Cleanup Refinements (Round 2) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden and polish the merged task-cleanup-cron feature: declare the missing hot-path index (and drop the stray dev-only one), stop deletions from bumping `updatedAt`, slim the cleanup criteria, refresh the README, and tighten two code shapes — all behavior-preserving.

**Architecture:** Five small, independent changes to the existing task module. No new files ship; one scratch script (deleted after use) syncs dev indexes with the schema and proves the query plan. Every code change is pinned by an existing test whose assertion updates in the same commit.

**Tech Stack:** Mongoose 9 (`syncIndexes`, `explain`), Vitest, existing node-cron/ioredis setup. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-10-task-cleanup-refinements-design.md`
**Branch:** `feat/task-cleanup-refinements` (already created; spec commit on it; rebased on main incl. PRs #32/#33)

**Context:** An executed review of `origin/main` found: (1) `getAllTasks` is index-served in dev only via a stray hand-made `userId_1_isCompleted_1` index that exists in no commit — a fresh DB collection-scans the hottest query; (2) the cron sweep and `deleteTask` bump `updatedAt` (schema `timestamps: true`), smudging the audit trail; (3) `$ne: null` in the cleanup criteria is provably redundant; (4) README predates PR #32's `noOverlap`; (5) two code shapes can be tighter.

**Standing rules for every task:** the working tree carries Nadav's own uncommitted comment removals across other files — never revert them, never stage them (`git add` only the paths each task names). Format only the files the task touched (`pnpm --filter @repo/server exec prettier --write <paths>`), never repo-wide `format`.

---

## File map

| File | Change |
| --- | --- |
| `apps/server/src/modules/task/task.schema.ts` | Modify — add `{ userId: 1, isDeleted: 1 }` index |
| `apps/server/src/modules/task/task.cleanup.ts` | Modify — `timestamps: false`, slimmer criteria, `Promise.all` invalidation |
| `apps/server/src/modules/task/task.cleanup.test.ts` | Modify — assertion updates |
| `apps/server/src/modules/task/task.service.ts` | Modify — `timestamps: false` on delete, conditional-spread update object |
| `apps/server/src/modules/task/task.service.test.ts` | Modify — delete assertion gains options arg |
| `apps/server/src/scripts/sync-task-indexes.ts` | Create (scratch, deleted after run — never committed) |
| `apps/server/README.md` | Modify — `noOverlap` sentence + index-table rows |

---

### Task 1: Declare the hot-path index + sync dev indexes

**Files:**
- Modify: `apps/server/src/modules/task/task.schema.ts`
- Create (scratch, NOT committed): `apps/server/src/scripts/sync-task-indexes.ts`

- [ ] **Step 1: Add the index declaration**

In `task.schema.ts`, directly below the existing index line, so the file reads:

```ts
taskSchema.index({ isDeleted: 1, isCompleted: 1, completedAt: 1 });
taskSchema.index({ userId: 1, isDeleted: 1 });
```

- [ ] **Step 2: Scratch sync-and-prove script**

Create `apps/server/src/scripts/sync-task-indexes.ts`:

```ts
import mongoose from 'mongoose';
import { env } from '../shared/config/env.ts';
import { TaskModel } from '../modules/task/task.schema.ts';

await mongoose.connect(env.MONGODB_URI);

try {
  console.log('before:', Object.keys(await TaskModel.collection.getIndexes()));
  await TaskModel.syncIndexes();
  console.log('after:', Object.keys(await TaskModel.collection.getIndexes()));

  const plan = await TaskModel.find({ userId: new mongoose.Types.ObjectId(), isDeleted: { $ne: true } })
    .explain('executionStats');
  const stats = (plan as { executionStats: { executionStages: unknown; totalKeysExamined: number; totalDocsExamined: number } }).executionStats;
  console.log('getAllTasks plan:', JSON.stringify(stats.executionStages).match(/"stage":"[A-Z_]+"|"indexName":"[^"]+"/g));
  console.log(`keys=${stats.totalKeysExamined} docs=${stats.totalDocsExamined}`);
} finally {
  await mongoose.disconnect();
}
```

`syncIndexes()` does both jobs in one call: builds every schema-declared index and **drops any index not declared in the schema** — which removes the stray `userId_1_isCompleted_1`. It is scoped to the Task collection only and is idempotent (safe to rerun).

- [ ] **Step 3: Run it (Mongo up first)**

```bash
cd apps/server && docker compose up -d && pnpm exec tsx --env-file=.env/.env.dev src/scripts/sync-task-indexes.ts
```

Expected output:
- `before:` includes `userId_1_isCompleted_1` (the stray) and lacks `userId_1_isDeleted_1`
- `after:` exactly `[ '_id_', 'isDeleted_1_isCompleted_1_completedAt_1', 'userId_1_isDeleted_1' ]`
- plan match includes `"indexName":"userId_1_isDeleted_1"` and an `IXSCAN` stage, `keys=0 docs=0` (random ObjectId matches nothing — the point is the chosen index, not the counts)

- [ ] **Step 4: Delete the scratch script, typecheck, commit**

```bash
rm apps/server/src/scripts/sync-task-indexes.ts
pnpm --filter @repo/server typecheck
git add apps/server/src/modules/task/task.schema.ts
git commit -m "feat(server): declare the userId+isDeleted index getAllTasks actually needs

Dev was index-served only by a stray hand-made index that exists in no
commit; a fresh database collection-scanned the hottest query. Dev
indexes synced to the schema (stray dropped) via a one-off syncIndexes.

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Deletion stops bumping `updatedAt`

**Files:**
- Modify: `apps/server/src/modules/task/task.cleanup.ts`
- Modify: `apps/server/src/modules/task/task.service.ts`
- Test: `apps/server/src/modules/task/task.cleanup.test.ts`, `apps/server/src/modules/task/task.service.test.ts`

- [ ] **Step 1: Tighten the pinned assertions (failing first)**

`task.cleanup.test.ts` — in the "soft-deletes tasks completed before the 7-day cutoff" spec, the `updateMany` assertion gains the options arg:

```ts
expect(TaskModel.updateMany).toHaveBeenCalledWith(
  expectedCriteria,
  { isDeleted: true, deletedAt: expect.any(Date) },
  { timestamps: false },
);
```

`task.service.test.ts` — in the "flips isDeleted/deletedAt instead of removing the doc, then invalidates" spec, the `findOneAndUpdate` assertion gains the same third arg:

```ts
expect(TaskModel.findOneAndUpdate).toHaveBeenCalledWith(
  { _id: 't1', userId, isDeleted: { $ne: true } },
  { isDeleted: true, deletedAt: expect.any(Date) },
  { timestamps: false },
);
```

- [ ] **Step 2: Verify both fail**

```bash
pnpm --filter @repo/server test -- task.cleanup && pnpm --filter @repo/server test -- task.service
```
Expected: 1 failure in each file — called without the third argument.

- [ ] **Step 3: Implement**

`task.cleanup.ts` — the `updateMany` call becomes:

```ts
const { modifiedCount } = await TaskModel.updateMany(
  criteria,
  { isDeleted: true, deletedAt: new Date() },
  { timestamps: false },
);
```

`task.service.ts` `deleteTask` — the `findOneAndUpdate` call becomes:

```ts
const doc = await TaskModel.findOneAndUpdate(
  { _id: id, userId, isDeleted: { $ne: true } },
  { isDeleted: true, deletedAt: new Date() },
  { timestamps: false },
).lean();
```

(`updatedAt` returns to meaning "the user's last action"; the backfill script already used this option.)

- [ ] **Step 4: Full server suite green**

```bash
pnpm --filter @repo/server test
```
Expected: all pass (60 tests).

- [ ] **Step 5: Format touched files, commit**

```bash
pnpm --filter @repo/server exec prettier --write src/modules/task/task.cleanup.ts src/modules/task/task.cleanup.test.ts src/modules/task/task.service.ts src/modules/task/task.service.test.ts
git add apps/server/src/modules/task/task.cleanup.ts apps/server/src/modules/task/task.cleanup.test.ts apps/server/src/modules/task/task.service.ts apps/server/src/modules/task/task.service.test.ts
git commit -m "fix(server): soft deletes no longer bump updatedAt (timestamps: false)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Slim the cleanup criteria

**Files:**
- Modify: `apps/server/src/modules/task/task.cleanup.ts`
- Test: `apps/server/src/modules/task/task.cleanup.test.ts`

- [ ] **Step 1: Update the pinned criteria (failing first)**

In `task.cleanup.test.ts`, `expectedCriteria` becomes:

```ts
const expectedCriteria = {
  isCompleted: true,
  isDeleted: { $ne: true },
  completedAt: { $lt: cutoff },
};
```

- [ ] **Step 2: Verify it fails**

```bash
pnpm --filter @repo/server test -- task.cleanup
```
Expected: FAIL — implementation still sends `$ne: null`.

- [ ] **Step 3: Implement**

In `task.cleanup.ts`, `criteria` becomes:

```ts
const criteria = {
  isCompleted: true,
  isDeleted: { $ne: true },
  completedAt: { $lt: cutoff },
};
```

(`$lt: <Date>` never matches null/missing — BSON type bracketing; proven empirically in the spec.)

- [ ] **Step 4: Suite green, format, commit**

```bash
pnpm --filter @repo/server test -- task.cleanup
pnpm --filter @repo/server exec prettier --write src/modules/task/task.cleanup.ts src/modules/task/task.cleanup.test.ts
git add apps/server/src/modules/task/task.cleanup.ts apps/server/src/modules/task/task.cleanup.test.ts
git commit -m "refactor(server): drop the redundant \$ne:null from the cleanup criteria

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Elegance pass (behavior-preserving)

**Files:**
- Modify: `apps/server/src/modules/task/task.cleanup.ts`
- Modify: `apps/server/src/modules/task/task.service.ts`

No assertion changes — the existing suite is the safety net and must pass untouched.

- [ ] **Step 1: Parallel cache invalidation**

In `task.cleanup.ts`, replace:

```ts
for (const uid of userIds) await taskCache.invalidate(uid.toString());
```

with:

```ts
await Promise.all(userIds.map((uid) => taskCache.invalidate(uid.toString())));
```

- [ ] **Step 2: Conditional-spread update object**

In `task.service.ts` `updateTask`, replace:

```ts
const update: Record<string, unknown> = { ...dto };
if (dto.isCompleted === true && !current.isCompleted) update['completedAt'] = new Date();
else if (dto.isCompleted === false && current.isCompleted) update['completedAt'] = null;
```

with:

```ts
const completes = dto.isCompleted === true && !current.isCompleted;
const uncompletes = dto.isCompleted === false && current.isCompleted;
const update = {
  ...dto,
  ...(completes && { completedAt: new Date() }),
  ...(uncompletes && { completedAt: null }),
};
```

(Spreading `false` is a no-op, so only the matching transition contributes a `completedAt` key — same semantics as before, declared in one expression.)

- [ ] **Step 3: Full server suite green untouched**

```bash
pnpm --filter @repo/server test && pnpm --filter @repo/server typecheck
```
Expected: all pass with zero test edits — that is the proof the pass was behavior-preserving.

- [ ] **Step 4: Format, commit**

```bash
pnpm --filter @repo/server exec prettier --write src/modules/task/task.cleanup.ts src/modules/task/task.service.ts
git add apps/server/src/modules/task/task.cleanup.ts apps/server/src/modules/task/task.service.ts
git commit -m "refactor(server): parallel cache invalidation; declarative completedAt update

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: README touch-ups + full gauntlet

**Files:**
- Modify: `apps/server/README.md`

- [ ] **Step 1: `noOverlap` sentence**

In the "Schedule" section (the paragraph beginning `` `node-cron` runs the job at `0 3 * * *` ``), append this sentence to the paragraph:

> The task is scheduled with `noOverlap: true`, so if a run is somehow still executing when the next tick fires, node-cron skips that tick — an in-process guard complementing the cross-instance Redis lock below.

- [ ] **Step 2: Index-table rows**

In the "Indexes" table (under `### Indexes`), add two rows:

```markdown
| `Task`         | `{ isDeleted: 1, isCompleted: 1, completedAt: 1 }` | Serves the nightly cleanup sweep's criteria            |
| `Task`         | `{ userId: 1, isDeleted: 1 }`                     | Serves every user's task-list read (`getAllTasks`)     |
```

Do NOT touch the stale `RefreshToken` rows — that's a separate chore.

- [ ] **Step 3: Full gauntlet (mirrors CI)**

```bash
pnpm format:check && pnpm turbo run lint typecheck test
```
Expected: all green. If `format:check` flags files Nadav's own edits touched, report it — do not "fix" his files.

- [ ] **Step 4: Commit (README only)**

```bash
git add apps/server/README.md
git commit -m "docs(server): document noOverlap and the task indexes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Verification summary

| Claim | Proven by |
| --- | --- |
| Fresh DBs get the hot-path index | Task 1: schema declaration + `after:` index list |
| Stray dev index gone, dev matches code | Task 1: `syncIndexes` + before/after print |
| `getAllTasks` is index-served | Task 1: explain shows IXSCAN on `userId_1_isDeleted_1` |
| Sweep/delete leave `updatedAt` alone | Task 2: tightened third-arg assertions (red → green) |
| Criteria slim + equivalent | Task 3: pinned-criteria test; empirical proof in spec |
| Elegance pass changed no behavior | Task 4: full suite passes with zero test edits |
| Docs match merged code | Task 5: README sentences + rows; full gauntlet green |

## Out of scope (per spec)

Cron-index ESR reshape, global soft-delete hook, broader README staleness (JWT rows, `npm install` wording), graceful HTTP shutdown, post/comment `isDeleted: false` legacy hazard.
