# Todo cache (cache-aside, Redis) — Design

**Date:** 2026-06-24
**Status:** Spec'd
**Project:** the Express server (`../server`), not the React app. The Todo feature's client is unchanged.

## Goal

Apply the **cache-aside** pattern to the server's `GET /tasks` endpoint using Redis. The
endpoint is read-heavy; most requests re-run the same per-user Mongo query and return the
same list. Caching that list cuts repeated DB reads, and the exercise teaches three things:

1. How cache-aside works (read-through on miss, serve-from-cache on hit).
2. Why a write must **invalidate** the cache to avoid stale reads.
3. **Why the cache key must be scoped per user** — the central learning goal.

This is a learning project, so the spec ends with a **Concepts** section answering the
thought-questions explicitly. Favor clarity over cleverness.

## Decisions (resolved during brainstorming)

| Decision | Choice | Why |
| --- | --- | --- |
| Redis client | **ioredis** | Most popular, ergonomic Promise API, strong TS types; `new Redis(url)` mirrors the existing `connectDB` shape. |
| Filtered `?isCompleted=` query | **Derive in-app from the cached full list** | One key per user, one invalidation point. See "Filtered queries" below. |
| TTL | **60 seconds** | Short enough that hit/miss/expiry is observable and a missed invalidation self-heals fast. |
| Run Redis | **`docker-compose.yml`, Redis-only** | Repeatable, self-documents the port. Mongo stays as-is (Atlas / existing local) to avoid disturbing a working setup. |
| `REDIS_URL` env | **Soft (not `requireEnv`)** | Cache is optional. A missing/unreachable Redis must degrade to Mongo, never `process.exit(1)`. |

## Architecture

New code mirrors the existing Mongo wiring so it slots into known patterns.

```
src/shared/config/redis.ts     # singleton ioredis client + connectRedis/disconnectRedis
src/shared/config/env.ts       # + REDIS_URL (soft; default redis://localhost:6379)
src/shared/cache/taskCache.ts  # key scheme, TTL, (de)serialize, hit/miss logging, fail-open
src/modules/task/task.service.ts  # cache-aside orchestration (data-access owner)
docker-compose.yml             # redis:7-alpine service (server root)
.env.example                   # + REDIS_URL
```

- **`redis.ts`** exports a singleton ioredis client plus `connectRedis()` / `disconnectRedis()`,
  mirroring `db.ts`. Wired into `index.ts` boot and the `SIGINT`/`SIGTERM` shutdown alongside
  Mongo. Connection errors are logged, not fatal.
- **`taskCache.ts`** is a thin helper so `task.service.ts` stays readable. It owns the key
  string, the TTL, JSON (de)serialization, the `[cache]` log lines, and the fail-open
  try/catch. Surface: `read(userId)`, `write(userId, tasks)`, `invalidate(userId)`.
- **`task.service.ts`** keeps the cache-aside orchestration (per the project's "service owns
  data access" rule). Controllers and the React client are unchanged.

## Key scheme, TTL, serialization

- **Key:** `tasks:user:<userId>` — namespaced, exactly one per user.
- **TTL:** 60s, applied via `SET key value EX 60`.
- **Value:** `JSON.stringify(TaskEntity[])` — the mapped entity array (post-`toTask`), so a hit
  returns with zero re-mapping.

## Read path — `getAllTasks(userId)` (cache-aside)

1. `GET tasks:user:<id>`.
2. **Hit** → log `[cache] HIT tasks user=<id>`, `JSON.parse`, return. Mongo untouched.
3. **Miss** → log `[cache] MISS tasks user=<id>`, query Mongo, map via `toTask`, `SET … EX 60`,
   return.
4. **Fail-open** → any Redis error is caught, logged as a warning, and the path falls through
   to Mongo. A down cache never breaks the endpoint.

## Filtered queries — `getTasksByStatus(userId, isCompleted)`

The full per-user list is the **single cached primitive**. The filtered variant stops querying
Mongo directly: it calls the cached `getAllTasks(userId)` and applies an in-memory
`.filter()`. Rationale (the "build it smart" call):

- Caching a separate key per filter combo (`tasks:user:X:completed`, …) is the
  **cache-explosion antipattern** for a small bounded dataset — more memory, and every write
  must invalidate *several* keys. That multiplied invalidation surface is precisely the
  forgot-to-invalidate bug we want to avoid.
- One key + derive-in-app = a single source of truth and a single invalidation point. The
  filtered path also benefits from cache hits. The filter is a cheap array op on an already
  small list.

## Write path — invalidation (create / update / delete)

After each successful Mongo write, the service calls `taskCache.invalidate(userId)` →
`DEL tasks:user:<id>` (also fail-open). The next read rebuilds from Mongo.

**Why delete, not update-in-place?** Delete is simple and always correct — the rebuild comes
from the source of truth. Updating the cached array in place means re-deriving exactly what
Mongo would return (ordering, defaults, concurrent writes), which is easy to get subtly wrong.
Update-in-place only pays off when the cached value is expensive to rebuild *and* writes are
frequent enough that recompute cost hurts. Neither holds for a small task list →
**delete-on-write**.

## Observability

Consistent, greppable log lines through winston:

- `[cache] HIT tasks user=<id>`
- `[cache] MISS tasks user=<id>`
- `[cache] INVALIDATE tasks user=<id>`
- `[cache] WARN <op> failed: <err>` (fail-open path)

Eyeball the hit ratio with `grep '\[cache\]'`. Hits / (hits + misses).

## Infrastructure

`docker-compose.yml` at the server root, Redis only:

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

`docker compose up -d` to start. `.env.example` gains `REDIS_URL=redis://localhost:6379`.

## Testing (Vitest)

Unit-test the cache-aside logic with a **mocked** ioredis client (no live Redis in CI):

- **Miss** → Mongo queried once + `SET` called with the right key/TTL.
- **Hit** → returns cached value, Mongo **not** queried.
- **Write** (create/update/delete) → `DEL` called with the user's key.
- **Fail-open** → Redis throwing on `GET`/`SET`/`DEL` still returns correct data from Mongo.
- **Per-user isolation** → user A's `write` does not touch user B's key.

## Out of scope

- Caching `GET /tasks/:id` (single task) or other modules (`post`, `comment`, `like`).
- Distributed cache concerns (cluster, eviction policy tuning, stampede locks).
- Changing the React client or the task entity shape.

## Concepts (the learning goals)

**1. What if the key were just per-task / not per-user? Imagine two logged-in users.**
A non-user-scoped key (e.g. `tasks:all`) makes all users share one cache entry. User A's GET
populates it; user B's GET hits it and receives **user A's tasks**. That's a cross-user data
leak — a security/correctness failure, far worse than staleness. Scoping the key with `userId`
(`tasks:user:<id>`) gives each user an isolated entry. This is the core lesson: a cache key
must encode *every* input that changes the result, and `userId` is such an input.

**2. Why invalidate (delete) instead of update the key? When is each better?**
Delete-on-write is correct-by-construction: drop the key, let the next read rebuild from the
DB. Update-in-place must reproduce the DB's exact result (ordering, derived fields, races) and
risks drift. Prefer **update-in-place** only when the cached value is expensive to recompute
*and* writes are frequent (so constant rebuilds would hurt). For a small, cheap-to-fetch task
list, **delete** wins.

**3. What hit ratio do we expect? When is it low?**
Hit ratio = hits / (hits + misses). It's high when reads dominate and the list changes
rarely — many GETs land between writes. It's **low** when: writes are frequent (each write
clears the key, forcing the next read to miss), the TTL is short relative to read spacing
(keys expire before being reused), or traffic per user is sparse (the key expires unused
between visits). A user who reads once a minute with a 60s TTL may miss nearly every time.

**4. If you forgot to also invalidate, how long is a stale list shown — and why?**
Up to the **TTL: 60 seconds**. Without invalidation, a write updates Mongo but the cached key
still holds the pre-write list, served on every hit until the `EX 60` expiry deletes it and
the next read repopulates. The TTL is the safety net that bounds staleness when invalidation
is missing or buggy — which is exactly why a cache that relies *only* on invalidation (no TTL)
can show stale data indefinitely.

**5. When is caching a frequently-changing list actually harmful?**
When writes outpace reads, the cache mostly stores entries that are invalidated before they're
ever reused — you pay the cost (Redis round-trips, serialization, an extra failure mode, code
complexity, a window of staleness) for almost no hit benefit. At that point caching is net
negative: it adds latency and risk without cutting DB load. Cache-aside assumes a
**read-heavy, write-light** access pattern; a write-heavy list violates that assumption.
