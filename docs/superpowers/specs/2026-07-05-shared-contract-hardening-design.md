# Design: Shared contract hardening — DTO-out enforcement + shared code

- **Date:** 2026-07-05
- **Status:** Spec'd
- **Topic slug:** shared-contract-hardening

## Goal

Make `packages/shared` enforce the **response** contract, not just the request
contract, and move genuinely-shared *code* (constants, an error envelope) into
the package. Concretely: stop the server from leaking DB-internal fields
(`userId`) over HTTP, centralize the duplicated title-length limit, and give
both sides one agreed shape for API *failures* (today they only agree on
successes).

## Background — what's wrong today

- **Request DTOs are enforced, response DTOs are not.** The controller validates
  request bodies with `validate(CreateTaskBodySchema, req.body)` (in). But
  `toTask()` in `task.service.ts` returns `TaskEntity` = `{ id, userId, title,
  isCompleted }`, and the controller `res.json()`s it directly at **five**
  response points. The shared `Task` schema omits `userId`, but it is **imported
  nowhere at runtime** — so `GET /api/tasks` actually ships `userId` on the wire.
  The web only *looks* clean because axios is typed `Task`; the real JSON has the
  extra field. Contract violation + minor info-disclosure.
- **Duplicated magic number.** `255` (max title length) appears twice inside
  `packages/shared/src/task.ts` (create + update schemas); the web input can't
  reuse it without a third copy.
- **No shared failure shape.** The server's `errorHandler` returns
  `{ error: string }` (+ `stack` in dev), but there is no shared type for it. The
  web's `todoStore` **ignores** the server's `error` field entirely and shows a
  hardcoded `'Could not load tasks. Please try again.'`. The two sides agree on
  success shapes but not on failure shapes.

## Scope guardrail

Touches only: `packages/shared/**`, `apps/server/src/modules/task/**`,
`apps/server/src/shared/middlewares/errorHandler.ts`, and the web todo error
path (`apps/web/src/lib/errors.ts` + `todoStore.ts` + the task input). **No
auth / better-auth files are touched** (better-auth landed just before this).

## Decisions

1. **Enforce the out-DTO at the service boundary, via `taskSchema.parse()`.**
   `toTask()` returns the shared `Task` (not `TaskEntity`):

   ```ts
   function toTask(doc: TaskDoc): Task {
     return taskSchema.parse({
       id: doc._id.toString(),
       title: doc.title,
       isCompleted: doc.isCompleted,
     })
   }
   ```

   `.parse()` was chosen over a hand-written `{ id, title, isCompleted }` mapper
   because it does both jobs: **strips** any field not in the contract (so a
   future `...doc` spread still can't leak `userId`) and **throws** if the server
   ever produces a malformed shape (a genuine server bug → correctly surfaces as
   a 500). This is symmetric with the request side: `validate()` guards *in*,
   `.parse()` guards *out*.

   Ripple effects: the service's return type becomes `Task[]`; `task.cache.ts`
   follows (bonus — the cache stops storing `userId`). `TaskEntity` in
   `task.entity.ts` becomes unused → delete it (keep only if something internal
   still needs it; verify during implement).

2. **Shared constants** in a new `packages/shared/src/constants.ts`:
   `TASK_TITLE_MAX_LENGTH = 255`, `TASK_TITLE_MIN_LENGTH = 1`. The `task.ts`
   schemas reference them instead of the literals; the web todo `<input>` uses
   `maxLength={TASK_TITLE_MAX_LENGTH}`. One source, three consumers.

3. **Shared error envelope** in a new `packages/shared/src/error.ts`:

   ```ts
   export const errorResponseSchema = z.object({ error: z.string() })
   export type ApiError = z.infer<typeof errorResponseSchema>
   ```

   Kept flat/minimal (no `code`/`details`) — the current server only produces a
   flat message, and YAGNI. The server's `errorHandler` builds its base payload
   typed as `ApiError`; it still appends `stack` in dev (a dev-only extra, not
   part of the client contract).

4. **Web surfaces the server message with a safe fallback.** A typed helper
   `parseApiError(err: unknown): string` in `apps/web/src/lib/errors.ts`:

   ```ts
   export function parseApiError(err: unknown, fallback = 'Something went wrong. Please try again.'): string {
     if (isAxiosError(err)) {
       const parsed = errorResponseSchema.safeParse(err.response?.data)
       if (parsed.success) return parsed.data.error
     }
     return fallback
   }
   ```

   `todoStore`'s catch blocks call it (e.g. `errorMessage: parseApiError(err,
   'Could not load tasks. Please try again.')`), so the UI surfaces real server
   messages when present and never crashes on an unexpected body / network error.

5. **`GetTasksQuerySchema` stays server-side.** It's querystring-specific
   coercion (`string → bool`) that only the server needs; the web filters
   client-side and never sends the query. Moving it would be speculative.

## Component / file map

**`packages/shared/src/`**
- `constants.ts` *(new)* — `TASK_TITLE_MAX_LENGTH`, `TASK_TITLE_MIN_LENGTH`.
- `error.ts` *(new)* — `errorResponseSchema`, `ApiError`.
- `task.ts` — schemas reference the constants (shape unchanged).
- `index.ts` — export the two new modules.
- `*.test.ts` — out-DTO strip test + error-schema test (see Testing).

**`apps/server/src/`**
- `modules/task/task.service.ts` — `toTask()` returns `Task` via `taskSchema.parse`; return types → `Task[]`.
- `modules/task/task.cache.ts` — cached type → `Task[]`.
- `modules/task/task.entity.ts` — remove `TaskEntity` if unused.
- `shared/middlewares/errorHandler.ts` — payload typed as `ApiError`.

**`apps/web/src/`**
- `lib/errors.ts` *(new)* — `parseApiError`.
- `features/todo/store/todoStore.ts` — catch blocks use `parseApiError`.
- the todo task input — `maxLength={TASK_TITLE_MAX_LENGTH}`.

## Testing (TDD)

- **shared:** `taskSchema.parse({ id, userId, title, isCompleted })` returns an
  object with **no `userId`** (proves the leak can't recur); `errorResponseSchema`
  accepts `{ error: 'x' }` and rejects `{}` / non-string `error`.
- **server:** a `task.service` unit test asserting the mapped result has no
  `userId` key (the response projection holds end-to-end).
- **web:** `parseApiError` — returns the server message from a well-formed axios
  error body; returns the fallback for a missing body / malformed shape / non-axios
  error.
- **Verification mirrors CI:** `pnpm format:check` + `pnpm turbo run lint
  typecheck test build` green before done.

## Out of scope

- No auth / better-auth changes.
- No error `code` / field-level `details` in the envelope.
- No `GetTasksQuerySchema` move.
- No new endpoints or route-path centralization.
