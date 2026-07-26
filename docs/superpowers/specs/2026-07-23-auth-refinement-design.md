# Auth refinement — design

**Date:** 2026-07-23
**Status:** Spec'd
**Predecessors:** PR #25 (Google OAuth + email/password via better-auth), PR #27 (shared contract hardening)

## Problem

The better-auth implementation works but is scattered and comment-heavy. Auth logic lives in seven-plus files across both apps with no single home on either side: the server keeps its better-auth instance in `shared/config/auth.ts` and the middleware in `shared/middlewares/`, while `modules/auth/` sits empty since PR #25 deleted the JWT module. The web side has `authClient` in `lib/`, `LoginPage` in `pages/`, and duplicated session-guard logic inline in two route files. Nearly every file leans on comments to explain non-obvious constraints (mount ordering, `transaction: false`, URL resolution, the never-throwing welcome hook).

## Goal

Every auth concern has one obvious home per side. Zero comments in touched files — constraints become self-evident through structure and naming, or move to CLAUDE.md. User-visible behavior is preserved.

## Non-goals

- No new features, flows, or dependencies.
- No visual changes to the login page.
- No reactive-session rework (`useSession` in router context) and no replacing `window.location.assign` with router navigation — that was the rejected Approach C.
- `lib/api.ts` stays in `lib/` (it is not auth-specific); only its comment goes.

## Design

### 1. Server — consolidate under `modules/auth/`

| New file | Moved from | Notes |
| --- | --- | --- |
| `modules/auth/auth.ts` | `shared/config/auth.ts` | better-auth instance. Config functionally identical: mongo adapter with `transaction: false`, cookie cache, email/password + Google, `role` additional field, welcome-mail hook. The hook body shrinks to a one-line `publishWelcomeEmail(...)` call — it already never throws. |
| `modules/auth/authenticate.ts` (+ test) | `shared/middlewares/authenticate.ts` | Same logic. `AuthUser` stays exported here; `shared/types/express.d.ts` updates its import. |

`app.ts` imports from `modules/auth` and loses all comments. Mount ordering (better-auth before `express.json()`) is already a documented constraint in CLAUDE.md; the path-to-regexp RegExp fallback and rate-limiter-before-auth notes join the CLAUDE.md landmine list.

### 2. Web — new `features/auth/`

| New file | Moved from / extracted | Notes |
| --- | --- | --- |
| `features/auth/authClient.ts` | `lib/authClient.ts` | The one-liner URL construction becomes a small named `resolveAuthBaseUrl` function whose shape explains dev-absolute vs prod-relative resolution without a comment. |
| `features/auth/guards.ts` | inline `beforeLoad`s in `routes/_authed.tsx` and `routes/login.tsx` | Two helpers: `requireSession` (redirect to `/login` when signed out; tolerate an unreachable auth server — today's graceful degradation) and `redirectIfSignedIn` (send signed-in visitors to `/tasks`). Both route files' `beforeLoad`s become one-liners. |
| `features/auth/components/LoginPage.tsx` | `pages/LoginPage.tsx` | Decomposed: `GoogleIcon.tsx` gets its own file; the email/password form splits into an `AuthForm` component so the page reads as layout, not logic. Visuals unchanged. Tests move alongside; `pages/LoginPage.tsx` and its test are deleted. |
| `features/auth/index.ts` | — | Public surface: `authClient`, guards, `LoginPage`. Header, routes, and tests import through it, per the features convention. |

### 3. Comments → docs

All touched files end with zero comments. CLAUDE.md gains a compact **Auth notes** list (~5 bullets):

1. better-auth mounts before `express.json()` (raw-body constraint) — consolidate the existing note.
2. `transaction: false` on the mongo adapter — standalone dev Mongo has no replica set; flip if running against Atlas.
3. Session cookie cache (5 min) skips the per-request Mongo read.
4. The welcome-mail hook runs post-commit and must never throw; `publishWelcomeEmail` swallows all errors by contract.
5. `authClient` base URL resolves `VITE_API_BASE_URL + '/auth'` against the page origin — absolute in dev, same-origin in prod.

### 4. Behavior and testing

User-visible behavior is unchanged: same flows, redirects, error toasts, and server-down degradation. Existing unit tests and `e2e/auth.spec.ts` must pass with only import-path updates. `/check` is the acceptance gate.

## Decisions log

- Scope: end-to-end (server + client + guards) — user choice.
- Simplification may change internals but not user-visible outcomes — user choice.
- Comment policy: zero comments; landmines to CLAUDE.md + structural naming — user choice.
- Web layout: introduce `features/auth/` per project convention — user choice.
- Approach: B (restructure into modules), over A (polish in place) and C (deep unification) — user choice.