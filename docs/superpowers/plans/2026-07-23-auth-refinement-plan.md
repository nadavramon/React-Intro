# Auth Refinement (Comment-Free Consolidation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Consolidate the better-auth surface merged in PRs #25/#27 into one home per side — server `modules/auth/`, web `features/auth/` — with zero comments in touched files, landmine knowledge moved to CLAUDE.md, and user-visible behavior unchanged.

**Architecture:** Pure moves + decomposition, no new behavior. Server: the better-auth instance and `authenticate` middleware (+ test) relocate from `shared/` into the empty `modules/auth/`. Web: a new `features/auth/` feature (authClient with a named URL resolver, a `guards.ts` shared by both route `beforeLoad`s, LoginPage decomposed into `GoogleIcon` + `AuthForm`), public surface via `index.ts`. Existing tests move with their files and pass with only path updates — that is the behavior-preservation proof.

**Tech Stack:** No new dependencies. better-auth, TanStack Router, Vitest, Playwright — all already in place.

**Spec:** `docs/superpowers/specs/2026-07-23-auth-refinement-design.md`
**Branch:** `feat/auth-refinement` (create from `main` in Task 1)

**Context:** Auth works but is scattered across 7+ files in `shared/`, `lib/`, `pages/`, and inline route guards, and every file leans on comments for its constraints. `modules/auth/` has sat empty since PR #25 deleted the JWT module. The user wants readable, minimalistic, comment-free, elegant.

**Standing rules for every task:** stage only the paths each task names; format only touched files (`pnpm --filter <pkg> exec prettier --write <paths>`), never repo-wide. Zero comments in every file this plan touches — if a constraint feels comment-worthy, it belongs in the Task 5 CLAUDE.md list instead.

---

## File map

| File | Change |
| --- | --- |
| `apps/server/src/modules/auth/auth.ts` | Create (git mv from `shared/config/auth.ts`) — comment-free, one-line hook |
| `apps/server/src/modules/auth/authenticate.ts` | Create (git mv from `shared/middlewares/authenticate.ts`) |
| `apps/server/src/modules/auth/authenticate.test.ts` | Create (git mv from `shared/middlewares/`) — mock path update only |
| `apps/server/src/app.ts` | Modify — import from `modules/auth`, strip all comments |
| `apps/server/src/modules/task/task.routes.ts`, `modules/post/post.routes.ts` | Modify — `authenticate` import path |
| `apps/server/src/shared/types/express.d.ts` | Modify — `AuthUser` import path |
| `apps/web/src/features/auth/authClient.ts` | Create — `resolveAuthBaseUrl` + client (replaces `lib/authClient.ts`) |
| `apps/web/src/features/auth/guards.ts` (+ `guards.test.ts`) | Create — `requireSession`, `redirectIfSignedIn` |
| `apps/web/src/features/auth/components/LoginPage.tsx` (+ test), `AuthForm.tsx`, `GoogleIcon.tsx` | Create — decomposed from `pages/LoginPage.tsx` |
| `apps/web/src/features/auth/index.ts` | Create — public surface |
| `apps/web/src/routes/_authed.tsx`, `routes/login.tsx` | Modify — one-liner `beforeLoad`s |
| `apps/web/src/layout/Header/Header.tsx` | Modify — import path only |
| `apps/web/src/lib/authClient.ts`, `pages/LoginPage.tsx`, `pages/LoginPage.test.tsx` | Delete |
| `apps/web/src/lib/api.ts` | Modify — strip comments only |
| `CLAUDE.md` | Modify — add **Auth notes** landmine list |

---

### Task 1: Server — consolidate into `modules/auth/`

**Files:** all server rows of the file map.

- [x] **Step 1: Branch**

```bash
git checkout -b feat/auth-refinement
```

- [x] **Step 2: Move the three files (history-preserving)**

```bash
git mv apps/server/src/shared/config/auth.ts apps/server/src/modules/auth/auth.ts
git mv apps/server/src/shared/middlewares/authenticate.ts apps/server/src/modules/auth/authenticate.ts
git mv apps/server/src/shared/middlewares/authenticate.test.ts apps/server/src/modules/auth/authenticate.test.ts
```

- [x] **Step 3: Fix `modules/auth/auth.ts`** — imports become `../../shared/config/env.ts` and `../mail/welcomeMail.publisher.ts`; strip every comment; the welcome hook collapses to a single expression (`publishWelcomeEmail` never throws by contract):

```ts
databaseHooks: {
  user: {
    create: {
      after: (user) => publishWelcomeEmail({ userId: user.id, email: user.email, name: user.name }),
    },
  },
},
```

Config values (`transaction: false`, `cookieCache`, `trustedOrigins`, providers, `role` field) stay byte-identical.

- [x] **Step 4: Fix `modules/auth/authenticate.ts`** — imports become `./auth.ts` and `../../shared/errors/AppError.ts`; strip comments; logic unchanged. In `authenticate.test.ts` the mock and import become `./auth.ts`.

- [x] **Step 5: Update the four importers**

- `app.ts`: `import { auth } from './modules/auth/auth.ts'` — and strip all comments from the file (mount ordering, rate-limiter, path-to-regexp, SPA-fallback notes all move to Task 5's CLAUDE.md list).
- `task.routes.ts` / `post.routes.ts`: `import { authenticate } from '../auth/authenticate.ts'`.
- `express.d.ts`: `import { AuthUser } from '../../modules/auth/authenticate.ts'`.

- [x] **Step 6: Green, format, commit**

```bash
pnpm --filter @repo/server typecheck && pnpm --filter @repo/server test
pnpm --filter @repo/server exec prettier --write src/modules/auth src/app.ts src/modules/task/task.routes.ts src/modules/post/post.routes.ts src/shared/types/express.d.ts
git add apps/server/src/modules/auth apps/server/src/shared/config apps/server/src/shared/middlewares apps/server/src/app.ts apps/server/src/modules/task/task.routes.ts apps/server/src/modules/post/post.routes.ts apps/server/src/shared/types/express.d.ts
git commit -m "refactor(server): consolidate better-auth into modules/auth

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Web — `features/auth/` core (client + guards)

**Files:** `features/auth/authClient.ts`, `features/auth/guards.ts` (+ test), `features/auth/index.ts`; modify `routes/_authed.tsx`, `routes/login.tsx`, `layout/Header/Header.tsx`, `pages/LoginPage.tsx` (+ test, import path only — decomposition is Task 3); delete `lib/authClient.ts`.

- [x] **Step 1: Guard tests first (failing — module doesn't exist yet)**

Create `apps/web/src/features/auth/guards.test.ts`. Mock `./authClient` (`getSession: vi.fn()`); use `isRedirect` from `@tanstack/react-router`:

- `requireSession` resolves (no throw) when `getSession` returns a session
- `requireSession` throws a redirect to `/login` when session is `null`
- `requireSession` resolves silently when `getSession` rejects (server down — graceful degradation)
- `redirectIfSignedIn` throws a redirect to `/tasks` when a session exists; resolves when `null`

- [x] **Step 2: Implement `features/auth/authClient.ts`**

```ts
import { createAuthClient } from 'better-auth/react'

function resolveAuthBaseUrl(apiBaseUrl: string) {
    return new URL(`${apiBaseUrl}/auth`, window.location.origin).href
}

export const authClient = createAuthClient({
    baseURL: resolveAuthBaseUrl(import.meta.env.VITE_API_BASE_URL),
})
```

- [x] **Step 3: Implement `features/auth/guards.ts`**

`requireSession`: today's `_authed` beforeLoad body verbatim (try/catch → return on error; `throw redirect({ to: '/login' })` on no session), comment-free. `redirectIfSignedIn`: today's `/login` beforeLoad body (`throw redirect({ to: '/tasks' })` on session).

- [x] **Step 4: `features/auth/index.ts`** — `export { authClient }`, `export { requireSession, redirectIfSignedIn }` (LoginPage export joins in Task 3).

- [x] **Step 5: Rewire importers, delete `lib/authClient.ts`**

- `routes/_authed.tsx`: `beforeLoad: requireSession` (imported from `@/features/auth`); drop the inline body + its comment.
- `routes/login.tsx`: `beforeLoad: redirectIfSignedIn`.
- `Header.tsx`, `pages/LoginPage.tsx`: import `authClient` from `@/features/auth`; in `pages/LoginPage.test.tsx` the mock path becomes `@/features/auth/authClient`.
- `git rm apps/web/src/lib/authClient.ts`.

- [x] **Step 6: Green, format, commit**

```bash
pnpm --filter @repo/web test && pnpm --filter @repo/web typecheck && pnpm --filter @repo/web lint
pnpm --filter @repo/web exec prettier --write src/features/auth src/routes/_authed.tsx src/routes/login.tsx src/layout/Header/Header.tsx src/pages/LoginPage.tsx src/pages/LoginPage.test.tsx
git add apps/web/src/features/auth apps/web/src/routes/_authed.tsx apps/web/src/routes/login.tsx apps/web/src/layout/Header/Header.tsx apps/web/src/pages/LoginPage.tsx apps/web/src/pages/LoginPage.test.tsx apps/web/src/lib/authClient.ts
git commit -m "refactor(web): features/auth — authClient + shared route guards

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Web — LoginPage decomposition

**Files:** create `features/auth/components/{LoginPage,AuthForm,GoogleIcon}.tsx` + `LoginPage.test.tsx`; modify `features/auth/index.ts`, `routes/login.tsx`; delete `pages/LoginPage.tsx` + test.

- [ ] **Step 1: Move the test first**

`git mv apps/web/src/pages/LoginPage.test.tsx apps/web/src/features/auth/components/LoginPage.test.tsx`; import becomes `./LoginPage` (named import). **Assertions stay untouched** — they pin the Google `callbackURL`, error surfacing, and both email flows, and must pass against the decomposed version as-is.

- [ ] **Step 2: Decompose (visuals byte-identical)**

- `GoogleIcon.tsx` — the svg component, verbatim minus comments.
- `AuthForm.tsx` — props `{ mode: Mode; error: string | null; onError: (message: string) => void }`. Owns `pending` state, `handleSubmit` (email sign-in/sign-up branch, `window.location.assign('/tasks')` on success), the name/email/password fields, the error `<p role="alert">`, and the submit button. `inputClasses`/`labelClasses` live here. Export the `Mode` type.
- `LoginPage.tsx` — named export. Owns `mode` + `error` state and `showError` (setError + toast); renders the card layout, scanline div, header copy, Google button + `handleGoogle`, divider, `<AuthForm />`, and the mode toggle.

- [ ] **Step 3: Rewire and delete**

- `features/auth/index.ts`: add `export { LoginPage } from './components/LoginPage'`.
- `routes/login.tsx`: `import { LoginPage } from '@/features/auth'`.
- `git rm apps/web/src/pages/LoginPage.tsx` (test already moved).

- [ ] **Step 4: Green, format, commit**

```bash
pnpm --filter @repo/web test && pnpm --filter @repo/web typecheck && pnpm --filter @repo/web lint
pnpm --filter @repo/web exec prettier --write src/features/auth src/routes/login.tsx
git add apps/web/src/features/auth apps/web/src/routes/login.tsx apps/web/src/pages
git commit -m "refactor(web): decompose LoginPage into features/auth components

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Comment sweep + CLAUDE.md Auth notes

**Files:** `apps/web/src/lib/api.ts`, `CLAUDE.md`.

- [ ] **Step 1: Strip the `api.ts` comment** (`withCredentials` line). Then sweep every file this plan touched for stragglers: `grep -n "//\|/\*" <touched files>` must return nothing (JSX `{/* */}` included).

- [ ] **Step 2: CLAUDE.md — Auth notes**

In the **Backend API contract** section, replace the existing better-auth mount bullet with a compact **Auth notes** list:

1. better-auth mounts before `express.json()` — it reads the raw body; the rate limiter mounts before it so auth endpoints are limited too.
2. Mongo adapter runs `transaction: false` — standalone dev Mongo has no replica set; flip if running against Atlas. It also opens its own `MongoClient` because it needs a Db handle before mongoose connects.
3. Session cookie cache (5 min signed cookie) skips the per-request Mongo read.
4. The welcome-mail hook runs post-commit and must never throw; `publishWelcomeEmail` swallows all errors by contract.
5. `authClient` resolves `VITE_API_BASE_URL + '/auth'` against the page origin — absolute in dev, same-origin in prod.
6. Express 5 note (path-to-regexp RegExp fallback for the SPA catch-all) — keep the existing CLAUDE.md stack bullet as the home for this; just confirm it still covers what app.ts's deleted comment said.

- [ ] **Step 3: Commit**

```bash
git add apps/web/src/lib/api.ts CLAUDE.md
git commit -m "docs: auth landmines move from comments to CLAUDE.md

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Full gauntlet + e2e + PR

- [ ] **Step 1: Full gauntlet (mirrors CI)**

```bash
pnpm format:check && pnpm turbo run lint typecheck test
```

- [ ] **Step 2: E2E (network-mocked, no servers needed)**

```bash
pnpm --filter @repo/web test:e2e
```

`auth.spec.ts` must pass unchanged — the guard wall-off and header account render are the end-to-end behavior proof.

- [ ] **Step 3: Push + PR**

```bash
git push -u origin feat/auth-refinement
gh pr create --title "refactor: consolidate auth into modules/auth + features/auth (comment-free)" --body "..."
```

PR body: spec link, the two consolidation moves, comment→CLAUDE.md policy, "behavior unchanged — all tests pass with only path updates". End with the standard generated-with footer.

---

## Verification summary

| Claim | Proven by |
| --- | --- |
| Server move is behavior-preserving | Task 1: `authenticate.test.ts` passes with only mock-path edits |
| Guards match today's beforeLoad semantics | Task 2: new `guards.test.ts` incl. server-down degradation case |
| LoginPage decomposition changed no behavior | Task 3: existing test assertions pass untouched |
| Zero comments in touched files | Task 4: grep sweep returns nothing |
| Whole-app behavior unchanged | Task 5: full gauntlet + e2e `auth.spec.ts` green |

## Out of scope (per spec)

Reactive session source (`useSession` in router context), router-navigation instead of full reloads, visual changes, `lib/api.ts` relocation, new features or dependencies.
