# Google OAuth via better-auth — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hand-rolled JWT auth with better-auth: Google OAuth + email/password under DB-backed cookie sessions, whole-app login guard, old auth module deleted.

**Architecture:** better-auth mounts at `/api/auth/*splat` (its default basePath — same URL the old routes occupy) *before* `express.json()`, persists to Mongo via `mongodbAdapter` on a dedicated `MongoClient`. The `authenticate` middleware swaps `jwt.verify` for `auth.api.getSession()` but preserves the `req.user = {userId, email, role}` contract, so task/post code is untouched. The web app gets a public `/login` route, a root-level `beforeLoad` session guard, and `withCredentials` axios; localStorage tokens and dev auto-login die.

**Tech Stack:** better-auth 1.6.23 (server + `better-auth/react` client), mongodb driver (moves to runtime deps), Express 5, TanStack Router file-based routes, Vitest, Playwright (network-mocked via `mockTasksApi`).

**Spec:** `docs/superpowers/specs/2026-07-03-google-oauth-better-auth-design.md`

**Context:** Assignment: swap manual JWT for Google-via-better-auth, learn external-lib integration + API-key hygiene. Decisions locked in the spec: better-auth owns ALL auth (email/password survives *through* it); cookie sessions; whole app behind `/login`; fresh start on user data (old `users`/`refreshtokens` collections abandoned, orphaned tasks accepted). Spec review already caught: absolute `callbackURL`, `mongodb` dev→runtime dep, e2e suite is network-mocked (every spec needs a `get-session` stub once the guard lands), dangling `ref: 'User'` + `express.d.ts` repoint.

**Working agreements baked in:** TDD every code task (Nadav: "SDD + TDD is a winning method" — runnable checks over claims). Never echo secret values — verify with pass/fail predicates. Feature branch + PR; Nadav merges. PR body: feature breakdown only, no test-plan section, no generated-by trailer.

**Environment assumptions:** local MongoDB reachable per `MONGODB_URI` (apps/server/docker-compose.yml has one), Node 24, pnpm via corepack. Dev servers: `pnpm dev` from root (web :5173, api :3000).

---

## File map

| File | Action | Responsibility |
| --- | --- | --- |
| `apps/server/src/shared/config/auth.ts` | create | the `betterAuth()` instance (adapter, providers, trustedOrigins, role additionalField) |
| `apps/server/src/shared/config/env.ts` | modify | −`JWT_SECRET`/`REFRESH_TOKEN_SECRET`, +`GOOGLE_CLIENT_ID`/`GOOGLE_CLIENT_SECRET`/`BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` |
| `apps/server/src/app.ts` | modify | mount `toNodeHandler(auth)` before `express.json()`; drop old authRoutes |
| `apps/server/src/shared/middlewares/authenticate.ts` | rewrite | session lookup via `auth.api.getSession`; exports `AuthUser` |
| `apps/server/src/shared/middlewares/authenticate.test.ts` | create | TDD for the rewrite |
| `apps/server/src/shared/types/express.d.ts` | modify | `req.user?: AuthUser` (repoint import) |
| `apps/server/src/modules/auth/**`, `src/modules/user/**` | delete | superseded by better-auth |
| `apps/server/src/modules/task/task.schema.ts` | modify | drop dangling `ref: 'User'` |
| `packages/shared/src/auth.ts` | delete | `loginBodySchema`/`authTokensSchema` die with the old flow |
| `apps/web/src/lib/authClient.ts` | create | `createAuthClient` (react) |
| `apps/web/src/lib/api.ts` | rewrite | `withCredentials`, 401→`/login`; delete auto-login machinery |
| `apps/web/src/pages/LoginPage.tsx` (+ `.test.tsx`) | create | login screen UI + RTL tests (authClient mocked) |
| `apps/web/src/routes/login.tsx` | create | public route; authed visitors bounce to `/tasks` |
| `apps/web/src/routes/__root.tsx` | modify | root `beforeLoad` session guard; todo `init()` moves out |
| `apps/web/src/routes/tasks.tsx` | modify | todo `init()` moves here |
| `apps/web/src/layout/Header/Header.tsx` | modify | session user + Sign out |
| `apps/web/e2e/helpers/mockTasksApi.ts` | modify | `/auth/login` stub → `get-session` stub (+ session-less variant) |
| `apps/web/e2e/auth.spec.ts` | create | guard redirect + login-screen e2e |
| `README.md`, `CLAUDE.md`, both `.env.example`s, `pnpm-workspace.yaml` | modify | docs/config blast radius |

---

### Task 0: Phase-1 gate — Google credentials exist (BLOCKING precondition)

**Files:** none (verification only). Nadav creates the Google Cloud OAuth client per spec Phase 1 (redirect URI `http://localhost:3000/api/auth/callback/google`).

- [x] **Step 1: Verify env keys exist without echoing values**

Run:
```bash
for k in GOOGLE_CLIENT_ID GOOGLE_CLIENT_SECRET BETTER_AUTH_SECRET BETTER_AUTH_URL MONGODB_URI; do
  grep -q "^$k=.\+" apps/server/.env/.env.dev && echo "$k: present" || echo "$k: MISSING"
done
```
Expected: five `present` lines. **Never print the values.** If `BETTER_AUTH_SECRET` is missing, Nadav generates one: `openssl rand -base64 32` (pasted by him, not echoed into the transcript). If any `MISSING` remains → **stop and ask Nadav**; Tasks 3+ cannot be runtime-verified without them.

- [x] **Step 2: Create the feature branch**

```bash
git switch main && git pull --ff-only && git switch -c feat/better-auth-google
```

### Task 1: Dependencies

**Files:** Modify: `apps/server/package.json`, `apps/web/package.json`, `pnpm-lock.yaml` (root)

- [x] **Step 1: Add better-auth to both apps; move mongodb to runtime deps**

```bash
pnpm --filter @repo/server add better-auth mongodb
pnpm --filter @repo/server remove --save-dev mongodb || true
pnpm --filter @repo/web add better-auth
```
Then verify `apps/server/package.json`: `mongodb` appears under `dependencies` only (delete the `devDependencies` line by hand if pnpm left it).

- [x] **Step 2: Clean root install + lockfile sanity**

Run: `pnpm install`
Expected: exits 0. Inspect `git diff pnpm-lock.yaml --stat` — additions for better-auth/its transitive deps; no surprise deletions of unrelated packages (lockfile-drift memory).

- [x] **Step 3: Baseline gauntlet still green**

Run: `pnpm turbo run typecheck test`
Expected: all packages pass (nothing imports better-auth yet).

- [x] **Step 4: Commit**

```bash
git add apps/server/package.json apps/web/package.json pnpm-lock.yaml
git commit -m "chore(auth): add better-auth; move mongodb to runtime deps"
```

### Task 2: Server env contract

**Files:** Modify: `apps/server/src/shared/config/env.ts`, `apps/server/.env.example`

**Green-chain strategy (Tasks 2→5):** each task compiles, tests green, and commits on its own. The old JWT module keeps compiling until Task 5 deletes it in one stroke — so the new env keys are *added* here and the old `JWT_SECRET`/`REFRESH_TOKEN_SECRET` are only *removed* in Task 5, together with their last consumers.

- [x] **Step 1: Extend `env.ts`** — add four keys, **keep the two JWT keys for now** (the not-yet-deleted old module still reads them):

```ts
export const env = {
  JWT_SECRET: requireEnv('JWT_SECRET'),               // dies in Task 5
  REFRESH_TOKEN_SECRET: requireEnv('REFRESH_TOKEN_SECRET'), // dies in Task 5
  MONGODB_URI: requireEnv('MONGODB_URI'),
  GOOGLE_CLIENT_ID: requireEnv('GOOGLE_CLIENT_ID'),
  GOOGLE_CLIENT_SECRET: requireEnv('GOOGLE_CLIENT_SECRET'),
  BETTER_AUTH_SECRET: requireEnv('BETTER_AUTH_SECRET'),
  BETTER_AUTH_URL: requireEnv('BETTER_AUTH_URL'),
  PORT: process.env.PORT,
  REDIS_URL: process.env.REDIS_URL ?? 'redis://localhost:6379',
};
```

- [x] **Step 2: Update `.env.example`** — add the four new keys with placeholders (`GOOGLE_CLIENT_ID=replace_me`, `BETTER_AUTH_URL=http://localhost:3000`, …); leave the JWT keys until Task 5 removes them.

- [x] **Step 3: Verify green + commit**

Run: `pnpm --filter @repo/server typecheck && pnpm --filter @repo/server test`
Expected: PASS.
```bash
git add apps/server/src/shared/config/env.ts apps/server/.env.example
git commit -m "feat(server): env contract for better-auth (Google creds, secret, base URL)"
```

### Task 3: better-auth instance + mount

**Files:** Create: `apps/server/src/shared/config/auth.ts`. Modify: `apps/server/src/app.ts`

- [x] **Step 1: Create `auth.ts`**

```ts
import { betterAuth } from 'better-auth';
import { mongodbAdapter } from 'better-auth/adapters/mongodb';
import { MongoClient } from 'mongodb';
import { env } from './env.ts';

// Dedicated client: the adapter needs a Db handle at module init,
// before mongoose's connectDB() has run.
const client = new MongoClient(env.MONGODB_URI);

export const auth = betterAuth({
  database: mongodbAdapter(client.db(), { client }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: ['http://localhost:5173'],
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  // Keep the @repo/shared User contract's `role`; input:false = clients can't set it.
  user: {
    additionalFields: {
      role: { type: 'string', defaultValue: 'user', input: false },
    },
  },
});
```

- [x] **Step 2: Mount in `app.ts`** — delete `import authRoutes …` and `app.use('/api/auth', authRoutes)`; add after the `cors()` line and **before** `express.json()` (handler needs the raw body):

```ts
import { toNodeHandler } from 'better-auth/node';
import { auth } from './shared/config/auth.ts';
// …
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.all('/api/auth/*splat', toNodeHandler(auth)); // Express 5 wildcard syntax
app.use(express.json());
```
(Known accepted gap: auth endpoints now sit before `limiter`; better-auth's own rate limiting covers prod.)

- [x] **Step 3: Runtime smoke — better-auth answers**

Run: `pnpm --filter @repo/server dev` (needs Mongo up), then in another shell:
`curl -s http://localhost:3000/api/auth/ok`
Expected: `{"ok":true}`. Also `curl -s -o /dev/null -w '%{http_code}' -X POST http://localhost:3000/api/auth/sign-up/email -H 'content-type: application/json' -d '{"name":"Smoke","email":"smoke@test.dev","password":"smoke-pass-123"}'` → `200`, and the `user`/`account`/`session` collections now exist in Mongo (`mongosh --eval 'db.getSiblingDB("server_dev").getCollectionNames()'` — adjust db name to MONGODB_URI).

- [x] **Step 4: Verify green + commit** (the old auth module still compiles — it still finds its env keys; it's simply unrouted now)

Run: `pnpm --filter @repo/server typecheck && pnpm --filter @repo/server test`
Expected: PASS.
```bash
git add apps/server/src/shared/config/auth.ts apps/server/src/app.ts
git commit -m "feat(server): mount better-auth at /api/auth (Google + email/password, Mongo adapter)"
```

### Task 4: `authenticate` middleware — TDD rewrite

**Files:** Create: `apps/server/src/shared/middlewares/authenticate.test.ts`. Rewrite: `authenticate.ts`. Modify: `apps/server/src/shared/types/express.d.ts`

- [x] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../config/auth.ts', () => ({ auth: { api: { getSession: vi.fn() } } }));

import { auth } from '../config/auth.ts';
import { authenticate } from './authenticate.ts';
import { UnauthorizedError } from '../errors/AppError.ts';
import type { Request, Response, NextFunction } from 'express';

const getSession = vi.mocked(auth.api.getSession);
const makeReq = () => ({ headers: { cookie: 'x' } }) as unknown as Request;
const res = {} as Response;

beforeEach(() => vi.clearAllMocks());

describe('authenticate (better-auth session)', () => {
  it('sets req.user from the session and calls next() with no error', async () => {
    getSession.mockResolvedValue({
      session: { id: 's1' },
      user: { id: 'u1', email: 'a@b.c', role: 'user' },
    } as never);
    const req = makeReq();
    const next = vi.fn() as NextFunction;
    await authenticate(req, res, next);
    expect(req.user).toEqual({ userId: 'u1', email: 'a@b.c', role: 'user' });
    expect(next).toHaveBeenCalledWith();
  });

  it('401s when there is no session', async () => {
    getSession.mockResolvedValue(null as never);
    const next = vi.fn() as NextFunction;
    await authenticate(makeReq(), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });

  it('401s when getSession throws', async () => {
    getSession.mockRejectedValue(new Error('boom'));
    const next = vi.fn() as NextFunction;
    await authenticate(makeReq(), res, next);
    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
  });
});
```

- [x] **Step 2: Run it — must fail** — `pnpm --filter @repo/server test -- authenticate`
Expected: FAIL (old implementation is sync + JWT-based; `req.user` shape comes from `jwt.verify`).

- [x] **Step 3: Rewrite `authenticate.ts`**

```ts
import { Request, Response, NextFunction } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import type { UserRole } from '@repo/shared';
import { auth } from '../config/auth.ts';
import { UnauthorizedError } from '../errors/AppError.ts';

export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
}

export async function authenticate(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) });
    if (!session) throw new UnauthorizedError('Not authenticated');
    req.user = {
      userId: session.user.id,
      email: session.user.email,
      role: (session.user.role ?? 'user') as UserRole,
    };
    next();
  } catch (err) {
    next(err instanceof UnauthorizedError ? err : new UnauthorizedError('Invalid session'));
  }
}
```

- [x] **Step 4: Repoint `express.d.ts`**

```ts
import { AuthUser } from '../middlewares/authenticate.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}
export {};
```

- [x] **Step 5: Run the test — green, whole package green, commit**

Run: `pnpm --filter @repo/server typecheck && pnpm --filter @repo/server test`
Expected: PASS (the old auth module is unrouted but still compiles until Task 5).
```bash
git add apps/server/src/shared/middlewares/authenticate.ts apps/server/src/shared/middlewares/authenticate.test.ts apps/server/src/shared/types/express.d.ts
git commit -m "feat(server): authenticate via better-auth session; preserve req.user contract (TDD)"
```

### Task 5: Delete the old auth machinery

**Files:** Delete: `apps/server/src/modules/auth/` (all 6 files), `apps/server/src/modules/user/` (all 3 files). Modify: `apps/server/src/shared/config/env.ts` (drop the two JWT keys now), `apps/server/.env.example` (same), `apps/server/src/modules/task/task.schema.ts` (drop `ref: 'User'`), `apps/server/package.json` (−`bcrypt`, −`jsonwebtoken`, −their `@types`), `pnpm-workspace.yaml` (drop `bcrypt` from `allowBuilds`; keep `esbuild`), `apps/server/src/shared/utils/swagger.ts` (remove old auth-endpoint docs if any survive the module deletion — the JSDoc lives in the deleted `auth.routes.ts`; grep to confirm).

- [x] **Step 1: Delete + prune**

```bash
git rm -r apps/server/src/modules/auth apps/server/src/modules/user
pnpm --filter @repo/server remove bcrypt jsonwebtoken @types/bcrypt @types/jsonwebtoken
grep -rn "auth/login\|/auth\b" apps/server/src/shared/utils/swagger.ts   # clean any leftovers
```
Now finish the env cleanup deferred from Task 2: remove `JWT_SECRET` + `REFRESH_TOKEN_SECRET` from `env.ts`, `.env.example`, **and their stubs in `apps/server/tests/setup.ts`** (Task 2 discovered env.ts is evaluated transitively by two test suites; four new-key stubs were added there — keep those) (their last consumers just got deleted). In `task.schema.ts`: `userId: { type: Schema.Types.ObjectId, required: true }` (ref gone). In `pnpm-workspace.yaml`: remove the `bcrypt` allowBuilds entry. Run `pnpm install` (lockfile shrinks; check diff for surprise deletions).

- [x] **Step 2: Server green again**

Run: `pnpm --filter @repo/server typecheck && pnpm --filter @repo/server test`
Expected: PASS; `grep -rn "jsonwebtoken\|bcrypt\|JwtPayload\|user.service\|refresh-token\|JWT_SECRET" apps/server/src` returns nothing.

- [x] **Step 3: Commit**

```bash
git add -A apps/server pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(server): delete JWT auth module — better-auth owns users, credentials, sessions"
```

### Task 6: Web — auth client + api.ts rewrite

**Files:** Create: `apps/web/src/lib/authClient.ts`. Rewrite: `apps/web/src/lib/api.ts`. Modify: `apps/web/.env.example` + `apps/web/.env.local` (drop `VITE_DEV_EMAIL`/`VITE_DEV_PASSWORD`)

- [x] **Step 1: `authClient.ts`**

```ts
import { createAuthClient } from 'better-auth/react'

// Dev: VITE_API_BASE_URL is absolute (http://localhost:3000/api) → new URL keeps it.
// Prod: it's '/api' (same-origin) → resolves against the page origin.
export const authClient = createAuthClient({
    baseURL: new URL(import.meta.env.VITE_API_BASE_URL + '/auth', window.location.origin).href,
})
```

- [x] **Step 2: Rewrite `api.ts`** (delete `login()`, `ensureLogin`, `TOKEN_KEY`, both old interceptors, the `AuthTokens` import):

```ts
import axios from 'axios'

export const api = axios.create({
    baseURL: import.meta.env.VITE_API_BASE_URL,
    withCredentials: true, // better-auth session cookie rides along
})

api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401 && window.location.pathname !== '/login')
            window.location.assign('/login')
        return Promise.reject(error)
    },
)
```

- [x] **Step 3: Web unit tests + typecheck**

Run: `pnpm --filter @repo/web typecheck && pnpm --filter @repo/web test`
Expected: PASS (todoStore tests mock the api module's methods, not the interceptors). If a test imported `login()` — delete that expectation; nothing else uses it (`grep -rn "lib/api" apps/web/src` to confirm call sites only use `api`).

- [x] **Step 4: Commit** — `git add apps/web/src/lib apps/web/.env.example && git commit -m "feat(web): better-auth client; cookie-credentialed axios, drop dev auto-login"` (`.env.local` is untracked — edit it but it won't be in the commit).

### Task 7: Login page — TDD component, then route

**Files:** Create: `apps/web/src/pages/LoginPage.test.tsx`, `apps/web/src/pages/LoginPage.tsx`, `apps/web/src/routes/login.tsx`
**Skills:** frontend-design

- [x] **Step 1: Failing RTL test first** (`LoginPage.test.tsx`):

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('@/lib/authClient', () => ({
    authClient: {
        signIn: { social: vi.fn(), email: vi.fn().mockResolvedValue({ data: {}, error: null }) },
        signUp: { email: vi.fn().mockResolvedValue({ data: {}, error: null }) },
    },
}))

import { authClient } from '@/lib/authClient'
import LoginPage from './LoginPage'

beforeEach(() => vi.clearAllMocks())

describe('LoginPage', () => {
    it('starts the Google flow with an absolute callbackURL', async () => {
        render(<LoginPage />)
        await userEvent.click(screen.getByRole('button', { name: /connect via google/i }))
        expect(authClient.signIn.social).toHaveBeenCalledWith({
            provider: 'google',
            callbackURL: `${window.location.origin}/tasks`,
        })
    })

    it('signs in with email/password', async () => {
        render(<LoginPage />)
        await userEvent.type(screen.getByLabelText(/email/i), 'a@b.c')
        await userEvent.type(screen.getByLabelText(/password/i), 'hunter22')
        await userEvent.click(screen.getByRole('button', { name: /sign in$/i }))
        expect(authClient.signIn.email).toHaveBeenCalledWith(
            expect.objectContaining({ email: 'a@b.c', password: 'hunter22' }),
        )
    })

    it('sign-up mode adds the required name field', async () => {
        render(<LoginPage />)
        await userEvent.click(screen.getByRole('button', { name: /need an account/i }))
        await userEvent.type(screen.getByLabelText(/name/i), 'Nadav')
        await userEvent.type(screen.getByLabelText(/email/i), 'a@b.c')
        await userEvent.type(screen.getByLabelText(/password/i), 'hunter22')
        await userEvent.click(screen.getByRole('button', { name: /sign up/i }))
        expect(authClient.signUp.email).toHaveBeenCalledWith(
            expect.objectContaining({ name: 'Nadav', email: 'a@b.c', password: 'hunter22' }),
        )
    })
})
```
Run `pnpm --filter @repo/web test -- LoginPage` → FAIL (module missing).

- [x] **Step 2: Implement `LoginPage.tsx`** — retro-arcade per `PRODUCT.md`/CLAUDE.md design context (bold, playful, WCAG AA, keyboard-navigable, no color-only state). Structure (styling is the implementer's craft, behavior is fixed):
  - `signIn.social({ provider: 'google', callbackURL: `${window.location.origin}/tasks` })` — **absolute URL, spec-critical** (relative would strand dev logins on `:3000`).
  - Email/password form with a sign-in ⇄ sign-up mode toggle ("Need an account? Sign up"); sign-up adds the **required `name` field** (better-auth 1.6 requires it).
  - On success: `window.location.assign('/tasks')` (full reload lets the root guard re-fetch the session). On `error`: `toast.error(error.message)` via the existing `sonner` Toaster; also render the message inline for AA (not color-alone).
  - Labels wired with `htmlFor`/`id` so the RTL `getByLabelText` queries pass.

- [x] **Step 3: Test green** — `pnpm --filter @repo/web test -- LoginPage` → 3 pass.

- [x] **Step 4: Route file `routes/login.tsx`** (public; authed users bounce):

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'
import LoginPage from '@/pages/LoginPage'
import { authClient } from '@/lib/authClient'

export const Route = createFileRoute('/login')({
    beforeLoad: async () => {
        const { data: session } = await authClient.getSession()
        if (session) throw redirect({ to: '/tasks' })
    },
    component: LoginPage,
})
```
Vite dev regenerates `routeTree.gen.ts` (generated; lint/format-ignored).

- [x] **Step 5: Commit** — `git add apps/web/src/pages/LoginPage* apps/web/src/routes/login.tsx apps/web/src/routeTree.gen.ts && git commit -m "feat(web): login screen — Google + email/password via better-auth"`

### Task 8: Whole-app guard + Header session UI — e2e-first

**Files:** Modify: `apps/web/e2e/helpers/mockTasksApi.ts`, `apps/web/src/routes/__root.tsx`, `apps/web/src/routes/tasks.tsx`, `apps/web/src/layout/Header/Header.tsx`. Create: `apps/web/e2e/auth.spec.ts`

- [x] **Step 1: Update the mock helper** — in `mockTasksApi.ts`, replace the `**/auth/login` stub with a session stub (all existing specs — counter included — call this helper in `beforeEach`, so they inherit authentication for free):

```ts
const now = () => new Date().toISOString()
export const mockSession = {
    session: { id: 'e2e-session', userId: 'e2e-user', expiresAt: now() },
    user: { id: 'e2e-user', email: 'e2e@test.dev', name: 'E2E', role: 'user' },
}

export async function mockAuthSession(page: Page, session: typeof mockSession | null = mockSession) {
    await page.route('**/api/auth/get-session', (route) =>
        route.fulfill({ json: session }),
    )
}
```
Call `await mockAuthSession(page)` at the top of `mockTasksApi` (so existing specs stay one-call). Keep the `**/tasks` stubs unchanged.

- [x] **Step 2: Failing e2e first** (`e2e/auth.spec.ts`):

```ts
import { test, expect } from '@playwright/test'
import { mockAuthSession, mockTasksApi } from './helpers/mockTasksApi'

test('unauthenticated visit is walled off to /login', async ({ page }) => {
    await mockAuthSession(page, null)
    await page.goto('/tasks')
    await expect(page).toHaveURL(/\/login$/)
    await expect(page.getByRole('button', { name: /connect via google/i })).toBeVisible()
})

test('authenticated user passes the guard and sees the header account', async ({ page }) => {
    await mockTasksApi(page)
    await page.goto('/tasks')
    await expect(page).toHaveURL(/\/tasks$/)
    await expect(page.getByRole('button', { name: /sign out/i })).toBeVisible()
})
```
Run: `pnpm --filter @repo/web test:e2e -- auth.spec.ts` → FAIL (no guard yet, no Sign out).

- [x] **Step 3: Root guard in `__root.tsx`** — add `beforeLoad`; move the todo `init()` effect out (it would fire a doomed fetch on `/login`):

```tsx
export const Route = createRootRoute({
    beforeLoad: async ({ location }) => {
        if (location.pathname === '/login') return
        const { data: session } = await authClient.getSession()
        if (!session) throw redirect({ to: '/login' })
    },
    component: RootComponent,
    notFoundComponent: NotFoundPage,
})
```
`RootComponent` loses the `useEffect`/`useTodoStore` import. In `routes/tasks.tsx`, re-home it (same pattern, route-scoped):

```tsx
// inside the tasks route component (or a small wrapper), before rendering the feature:
useEffect(() => {
    useTodoStore.getState().init()
}, [])
```

- [x] **Step 4: Header account UI** — in `Header.tsx`, right-aligned cluster: `const { data: session } = authClient.useSession()`; when present show `session.user.name` (+ avatar `img` if `session.user.image`, with empty-`alt` since the name is adjacent) and a **Sign out** button → `authClient.signOut()` then `window.location.assign('/login')`. Keyboard-focusable, visible focus ring, matches the existing header idiom.

- [x] **Step 5: e2e green — new and old**

Run: `pnpm --filter @repo/web test:e2e`
Expected: `auth.spec.ts` passes AND the pre-existing suite (counter, todo-global-state) still passes — proving the guard didn't break the mocked specs.

- [x] **Step 6: Commit** — `git add apps/web/src apps/web/e2e && git commit -m "feat(web): whole-app session guard, header account UI; e2e session stubs"`

### Task 9: Shared contract + docs blast radius

**Files:** Delete: `packages/shared/src/auth.ts`. Modify: `packages/shared/src/index.ts`, `README.md`, `CLAUDE.md`, (already done: both `.env.example`s)

- [x] **Step 1: Shared cleanup** — delete `packages/shared/src/auth.ts` (`loginBodySchema`, `authTokensSchema` have no remaining importers — verify: `grep -rn "AuthTokens\|loginBodySchema\|authTokensSchema" apps packages --include='*.ts*' | grep -v shared/src` → empty); drop the `export * from './auth.ts'` line from `index.ts`. `userPublicSchema`/`UserRole` stay. Run `pnpm --filter @repo/shared build && pnpm turbo run typecheck` → green.

- [x] **Step 2: README** — fix the "JWT API" label (line ~8), the dev-credentials setup line (~26: now "sign in via Google or email/password; server needs Google OAuth credentials — see `apps/server/.env.example`"), the shared-contract list (~46: remove `loginBodySchema`/`authTokensSchema`); append the spec's four Q&A prose blocks (redirect/callback/exchange; secret placement; what better-auth replaces; identity vs authorization — copy from the spec's "four assignment questions" section).

- [x] **Step 3: CLAUDE.md** — rewrite the "Backend API contract" auth paragraphs: cookie sessions via better-auth, `/api/auth/*` handled by `toNodeHandler` (mounted before `express.json()` — note this as a constraint), login screen at `/login`, whole-app guard, no more `VITE_DEV_*`/localStorage/known-gap note; stack line: replace "JWT auth" with "better-auth (Google + email/password, cookie sessions)".

- [x] **Step 4: Commit** — `git add packages/shared README.md CLAUDE.md && git commit -m "docs+shared: retire JWT contract; document better-auth flow and the four assignment answers"`

### Task 10: Full verification — gauntlet + real flows

**Files:** none (verification)

- [x] **Step 1: The gauntlet** — run `/check --e2e` (= `pnpm format:check` + `turbo run lint typecheck test` + Playwright). Expected: all green. Fix anything it surfaces before proceeding.

- [x] **Step 2: Real email/password round-trip (dev servers + Mongo up)**

```bash
# sign-up sets a session cookie; the cookie jar proves the round-trip
curl -s -c /tmp/ba-jar -X POST http://localhost:3000/api/auth/sign-up/email \
  -H 'content-type: application/json' \
  -d '{"name":"Verify","email":"verify@test.dev","password":"verify-pass-123"}' -o /dev/null -w '%{http_code}\n'   # 200
curl -s -b /tmp/ba-jar http://localhost:3000/api/tasks | head -c 200; echo                                        # 200 + [] (empty task list)
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/api/tasks                                          # 401 (no cookie)
```

- [x] **Step 3: Manual Google flow (Nadav, once)** — browser at `http://localhost:5173` → redirected to `/login` → "Connect via Google" → consent → lands on `/tasks`; header shows Google name/avatar; `mongosh` shows the `google` row in `account` linked to the `user` doc; Sign out returns to `/login` and `/tasks` is walled again. Result recorded in the journal.

- [x] **Step 4: Push + PR**

```bash
git push -u origin feat/better-auth-google
gh pr create --title "feat: Google OAuth + email/password via better-auth (replaces JWT module)" --body-file <breakdown per PR-format memory: feature bullets only>
```

---

## Verification summary (what proves this works)

| Layer | Check |
| --- | --- |
| Middleware | 3 unit tests (session→`req.user`, none→401, throw→401) |
| Login UI | 3 RTL tests (Google callbackURL, sign-in, sign-up+name) |
| Guard + header | 2 new e2e + entire pre-existing e2e suite under the new session stub |
| Server wiring | `curl /api/auth/ok`, real sign-up → cookie → `/api/tasks` 200/401 contrast |
| Google (unautomatable) | one manual pass, journaled |
| Whole repo | `/check --e2e` gauntlet |

## Out of scope (per spec)

Data migration, role enforcement, more providers, email verification, password reset, prod deploy work (checklist lives in the spec's Ops notes).
