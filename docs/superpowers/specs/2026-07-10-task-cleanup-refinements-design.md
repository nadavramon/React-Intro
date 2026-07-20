# Design: Task-cleanup refinements (round 2)

**Date:** 2026-07-10
**Status:** Spec'd
**Slug:** task-cleanup-refinements
**Predecessor:** `2026-07-10-task-cleanup-cron-design.md` (merged as PR #30; hardened by #32, #33)

## Goal

A small hardening + polish pass over the merged task-cleanup-cron feature, driven by an
executed review of `origin/main` (live `.explain()` plans against dev Mongo, installed-types
checks). Five items, all behavior-preserving except where a query gets strictly faster or an
audit field stops being overwritten.

## Findings driving this round (evidence)

- **The hot-path index exists only by accident.** `getAllTasks` filters
  `{ userId, isDeleted: { $ne: true } }` on every cache miss, but the only *declared*
  secondary index is the cron's `{ isDeleted, isCompleted, completedAt }`, which cannot
  serve a `userId` lookup. Dev is fast because of a stray `userId_1_isCompleted_1` index
  that appears in **no commit in either repo's history** — hand-made directly in the dev
  DB. A fresh database collection-scans the app's hottest query.
- **Sweeps rewrite `updatedAt`.** The cron's `updateMany` and `deleteTask`'s
  `findOneAndUpdate` run with schema `timestamps: true`, so soft-deleting bumps
  `updatedAt` — the exact smudge the backfill script had to work around (and itself
  avoids with `timestamps: false`).
- **`$ne: null` in the cleanup criteria is redundant.** Proven empirically: match counts
  with vs without are identical (BSON type bracketing — `$lt: <Date>` never matches
  null/missing), plans identical.
- **README lags the merged code.** No mention of `noOverlap` (landed in #32 after the
  docs); the index table omits the task indexes.
- **Readability.** The invalidation loop is sequential for no reason; `updateTask` builds
  its update object by mutating a `Record<string, unknown>` across three statements.

## Design

### 1. Declare the hot-path index (`task.schema.ts`)

```ts
taskSchema.index({ userId: 1, isDeleted: 1 });
```

Serves `getAllTasks` directly and prefixes the `{ _id, userId, isDeleted }` guards.
One-off dev cleanup: drop the stray `userId_1_isCompleted_1` via `mongosh` (docker), so
dev matches code. Verification: `.explain()` on the `getAllTasks` filter shows IXSCAN on
the new index.

### 2. Deletion stops touching `updatedAt`

Both write sites gain `{ timestamps: false }`:

- `task.cleanup.ts` — `updateMany(criteria, { isDeleted: true, deletedAt: new Date() }, { timestamps: false })`
- `task.service.ts` `deleteTask` — same option on its `findOneAndUpdate`.

`updatedAt` returns to meaning "the user's last action". The pinned test assertions gain
the options argument.

### 3. Slim the cleanup criteria

`completedAt: { $ne: null, $lt: cutoff }` → `completedAt: { $lt: cutoff }`.
The test's `expectedCriteria` updates in the same commit.

### 4. README touch-ups (feature-scoped only)

- One sentence under the cron section: `noOverlap: true` skips a tick if the previous
  run is still executing (in-process guard, complementing the cross-instance Redis lock).
- Index table gains the two task indexes (cron compound + new `{ userId, isDeleted }`).
- The stale JWT-era rows in that table are **not** this round (separate chore).

### 5. Elegance pass (behavior-preserving)

- `task.cleanup.ts`: sequential invalidation loop →
  `await Promise.all(userIds.map((uid) => taskCache.invalidate(uid.toString())));`
  (shorter and parallel — invalidations are independent).
- `task.service.ts` `updateTask`: replace the mutated `Record<string, unknown>` with a
  typed object built via conditional spreads:

```ts
const completes = dto.isCompleted === true && !current.isCompleted;
const uncompletes = dto.isCompleted === false && current.isCompleted;
const update = {
  ...dto,
  ...(completes && { completedAt: new Date() }),
  ...(uncompletes && { completedAt: null }),
};
```

Strictly no behavior change: the existing suite passes untouched except the assertion
updates items 2–3 already require.

## Testing & verification

- Adjust the pinned assertions (`task.cleanup.test.ts` criteria + options arg;
  `task.service.test.ts` delete options arg). No new test files.
- Live: `.explain()` on the `getAllTasks` filter before/after (COLLSCAN† → IXSCAN);
  stray index confirmed dropped (`getIndexes()`).
  † after dropping the stray index; with it present the "before" plan is masked.
- Full gauntlet (`pnpm format:check && pnpm turbo run lint typecheck test`) before Done.

## Out of scope (deliberately)

- Cron-index ESR reshape — measured unnecessary (2 keys / 0 docs examined daily).
- Global soft-delete `pre(/^find/)` hook — wouldn't cover `distinct`/`updateMany`, and
  `$ne: true` is load-bearing: 11 of 15 dev docs predate the field entirely.
- Broader README staleness (JWT-era rows, `npm install` wording) — separate chore.
- Graceful HTTP shutdown (`server.close()`), post/comment modules' equality-form
  `isDeleted: false` legacy hazard — pre-existing, separate chores.

## Process notes

- Branch `feat/task-cleanup-refinements` off main; one PR at the end.
- PR #33 (backfill try/finally) merges first, by Nadav; this branch rebases on it.
- Working tree carries Nadav's own comment removals — they are intentional, stay
  uncommitted here, and must not be reverted or included in this round's commits.
