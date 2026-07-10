# Design: Scheduled cleanup of old completed todos (soft delete)

**Date:** 2026-07-10
**Status:** Spec'd
**Slug:** task-cleanup-cron

## Goal

A daily cron job inside the Express server soft-deletes todos that were completed more
than a week ago. Soft-deleted todos disappear from every API response but stay in Mongo,
restorable by flipping one field. The user-facing DELETE endpoint switches to soft delete
too, so the app has exactly one deletion semantic.

This is a retention policy in miniature: "completed + 7 days" is the retention rule, the
cron is the enforcement mechanism, and soft delete is the grace period.

## Current state

- `task.schema.ts` — Mongoose schema with `userId`, `title`, `isCompleted`, `timestamps: true`. No completion or deletion timestamps.
- `task.service.ts` — `deleteTask` is a hard `findOneAndDelete`; all reads return every non-deleted-because-nothing-is-ever-deleted doc.
- Per-user Redis cache (`task.cache.ts`), cache-aside with invalidation on every write. Redis is optional — the app degrades to no-cache when it's down.
- No scheduler library installed. Lifecycle (Redis, RabbitMQ) is wired in `index.ts`; `app.ts` stays side-effect-free so Vitest can import it.

## Decisions (with rationale)

| Decision | Choice | Why |
| --- | --- | --- |
| Scheduler | `node-cron`, `0 3 * * *` | Real cron syntax (the learning goal); tiny dep. `setInterval` drifts and has no "at 3am"; BullMQ/Agenda is infra overkill for one daily job. |
| Soft-delete scope | Everywhere (cron **and** user DELETE) | One deletion semantic; every read gets the same filter; everything restorable. Cron-only soft delete leaves two inconsistent deletion stories. |
| Existing completed tasks | One-time backfill `completedAt = updatedAt` | Schema change ⇒ think about existing rows. `updatedAt` is a fair proxy for when completion happened. |
| Multi-instance safety | Redis lock, best-effort | `SET NX PX` on the existing ioredis client. Redis down ⇒ run anyway and log — safe because the job is idempotent (see Discussion). |
| Query filtering | Explicit `isDeleted: { $ne: true }` in each service query | Visible for learning. A global Mongoose plugin/pre-find hook is the compaction step later, once the pattern is understood. |
| Shared contract | Unchanged | `completedAt` / `isDeleted` / `deletedAt` never cross the HTTP boundary (per the `@repo/shared` rule). Known product gap noted below. |

## Design

### 1. Schema changes (`apps/server/src/modules/task/task.schema.ts`)

```ts
completedAt: { type: Date, default: null },
isDeleted:   { type: Boolean, default: false },
deletedAt:   { type: Date, default: null },
```

Plus a compound index for the cron query: `{ isDeleted: 1, isCompleted: 1, completedAt: 1 }`.

`completedAt` rules (implemented in the **service layer**, not Mongoose hooks, so the logic
stays visible):

- Set to `now` when `isCompleted` transitions **false → true** — on `createTask` (the body allows `isCompleted: true`) **and** on `updateTask`.
- Cleared (`null`) when a task is un-completed. Re-completing restarts the 7-day clock.
- **Transition-only:** an update that sends `isCompleted: true` for an already-completed task, or edits only the title, must NOT reset the clock. The update logic compares against the current document state, not just the incoming dto.

### 2. Soft delete in the service (`task.service.ts`)

- `deleteTask` → `findOneAndUpdate({ _id, userId, isDeleted: { $ne: true } }, { isDeleted: true, deletedAt: now })`. Deleting an already-deleted task is a 404 (consistent with reads).
- `getAllTasks`, `getTaskById`, `updateTask` add `isDeleted: { $ne: true }` to their queries. (`getTasksByStatus` filters in memory from `getAllTasks`, so it's covered for free.)
- No restore endpoint (YAGNI) — restore is a one-field flip if ever wanted.

### 3. The cron job (`apps/server/src/modules/task/task.cleanup.ts`)

Daily at `0 3 * * *` (server TZ = UTC in the Docker image; documented, not configurable):

1. **Acquire lock** (best-effort, see §4). Not acquired ⇒ log + skip.
2. Compute `cutoff = now − 7 days`.
3. Find **distinct `userId`s** matching `{ isCompleted: true, isDeleted: { $ne: true }, completedAt: { $lt: cutoff, $ne: null } }`.
4. `updateMany` the same criteria → `{ isDeleted: true, deletedAt: now }`.
5. **Invalidate the cache for each affected user** — the cron bypasses the service, so without this the web app serves "deleted" todos until the cache TTL expires.
6. Log the soft-deleted count (and `0` runs too, so the job is observably alive).

Wiring: registered in `index.ts` (never `app.ts` — Vitest imports `app.ts`, so tests stay
cron-free, same seam Redis/RabbitMQ use) and stopped in the graceful-shutdown path.
The core logic lives in an exported `cleanupOldTasks()` function so tests (and manual
verification) call it directly without waiting for 3am.

### 4. Distributed lock (best-effort)

```
SET cron:task-cleanup <instanceId> NX PX 600000   // ~10 min TTL
```

- Key already exists ⇒ another instance won this run ⇒ skip.
- **Redis down ⇒ run anyway** and log the degradation. The job is idempotent, so a duplicate run is wasted work, not corruption. (For a non-idempotent job — billing, emails — the right fallback is *skip*.)
- **The lock is not released on completion.** If instance A finished in 2s and deleted the key, instance B's cron firing at 3:00:05 would acquire it and run again. Letting the TTL expire naturally *is* the design, not a leak.

### 5. Backfill (one-off script)

`apps/server/scripts/backfill-completed-at.ts`, run manually with `tsx`:
set `completedAt = updatedAt` for docs where `isCompleted: true` and `completedAt` is
missing/null. Run once, verify, done — not a boot-time auto-migration.

### 6. Testing & verification

- **Unit (Vitest, `task.cleanup.test.ts`):** cutoff math (7d − 1min stays, 7d + 1min goes); un-deleted only; lock acquired / lock held ⇒ skip / Redis down ⇒ run + log; cache invalidated per affected user; count logged.
- **Service tests (extend existing):** `completedAt` set on create-completed and on false→true update; NOT reset on title-only or redundant `isCompleted: true` update; cleared on un-complete; soft delete filters on all reads; delete-twice ⇒ 404.
- **Manual verification:** seed a task with `completedAt` 8 days back, call `cleanupOldTasks()`, confirm it vanishes from `GET /api/tasks` and the Mongo doc has `isDeleted: true`.
- Web e2e untouched (fully network-mocked; response shapes unchanged).

## Out of scope (deliberately)

- **User-visible warning / `completedAt` in the shared contract.** Known product gap: completed todos silently vanish after 7 days. A real product would surface "completed items are removed after 7 days" or expose `completedAt` so the UI can hint. Natural follow-up feature.
- **Second retention tier** — hard-deleting soft-deleted rows after N more days (the full data-retention pattern). The `deletedAt` field is exactly what that tier would query on.
- **Restore endpoint**, swagger changes (shapes unchanged), web UI changes.

## Discussion — the assignment's four questions

**Why soft delete instead of hard delete?** Hard delete is irreversible — a bug in the
cutoff query (or in this very feature) destroys user data with no recourse. Soft delete
makes deletion a *state*, not an *event*: restore is `isDeleted: false`, audits can see
what was deleted and when (`deletedAt`), and the destructive step can be deferred to a
second, much-lower-stakes job. The cost: every read query must remember the filter, and
storage grows until a hard-delete tier exists.

**How does a query identify "more than a week ago"?** Compute the cutoff in JS
(`new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)`) and compare stored timestamps against
it: `completedAt: { $lt: cutoff }`. The rule of thumb: store absolute timestamps, compute
relative windows at query time. That's why `completedAt` must exist — you can't ask
"how long has this been completed?" of a boolean.

**Multi-instance risk & the distributed lock?** Every instance has its own in-process
cron, so N instances = N runs at 3am. For this idempotent job that's just waste; for a
non-idempotent one it's double-charging. Fix: a shared lock in a store all instances see
(Redis `SET NX PX`). `NX` makes acquire-if-absent atomic; `PX` guarantees the lock dies
even if the holder crashes mid-run. Alternatives at scale: leader election, or moving
scheduling out of the app entirely (BullMQ repeatable jobs, K8s CronJob).

**Similarity to data retention?** This *is* a retention policy: a rule ("completed
todos live 7 days"), an enforcement job (the cron), and a grace tier (soft delete before
any hard delete). GDPR-style retention works the same way — usually with a second job
that hard-deletes after the grace period, which is exactly the out-of-scope extension
above.
