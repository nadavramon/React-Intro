# Google OAuth via better-auth — Design

**Date:** 2026-07-03
**Status:** Spec'd
**Assignment:** Replace the hand-rolled JWT auth with [better-auth](https://www.better-auth.com) + Google OAuth. Learning goals: driving an external auth library instead of building the machinery yourself, and handling API credentials (Client ID/Secret) properly.

## Decisions (locked with Nadav)

1. **better-auth owns all auth.** Google social login **and** email/password both go through better-auth. The hand-rolled JWT module (register/login/refresh/logout, refresh-token collection, bcrypt credential checks) is **deleted**, not kept in parallel. "Email/password survives" means it survives *through better-auth*.
2. **Cookie sessions** (better-auth's default): a DB-backed session referenced by an httpOnly cookie. No more access token in `localStorage`, no refresh-token juggling on the client.
3. **Whole app behind login.** Every client route except `/login` redirects to `/login` when there is no session. (The server independently keeps protecting `/api/tasks` — the client guard is UX, the server guard is security.)
4. **Fresh start on user data.** Old `users` + `refreshtokens` collections are abandoned; better-auth creates its own `user`/`session`/`account`/`verification` collections. Old bcrypt users don't carry over (better-auth stores credentials in its own `account` collection with its own hashing); existing tasks keyed to old userIds become orphans. Acceptable for a learning sandbox — no migration script.

## Current state (what gets replaced)

- **Server** (`apps/server`): `modules/auth/*` implements register/login/refresh/logout with `jsonwebtoken` + `bcrypt`; refresh tokens persisted via `refresh-token.schema.ts`; `shared/middlewares/authenticate.ts` verifies a `Bearer` access token and sets `req.user = { userId, email, role }`. Tasks are scoped by `req.user.userId`. Auth is mounted at `/api/auth` — which happens to be **exactly better-auth's default `basePath`**, so the URL surface doesn't move.
- **Web** (`apps/web`): `src/lib/api.ts` silently auto-logs-in with `VITE_DEV_EMAIL`/`VITE_DEV_PASSWORD`, stores `accessToken` in `localStorage`, retries once on 401. No login screen, no route protection.
- **Shared** (`packages/shared`): `loginBodySchema`/`authTokensSchema` (client-built login bodies and token pairs — both obsolete under better-auth) and `userPublicSchema` (`id`, `email`, `role`).
- `role` is carried in the JWT payload but **enforced nowhere** (no role-checking middleware exists).

## Phase 1 — Google Cloud credentials (manual, Nadav does this)

1. In [Google Cloud Console](https://console.cloud.google.com) create a project (e.g. `react-intro-dev`), configure the OAuth consent screen (External, test mode, add your Google account as a test user), and create an **OAuth 2.0 Client ID** of type *Web application*:
   - **Authorized JavaScript origins:** `http://localhost:5173`, `http://localhost:3000`
   - **Authorized redirect URI:** `http://localhost:3000/api/auth/callback/google` (better-auth's fixed callback path — Google redirects to the **server**, not the SPA)
2. Put the credentials in `apps/server/.env/.env.dev` (already gitignored): `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, plus `BETTER_AUTH_SECRET` (generate: `openssl rand -base64 32`) and `BETTER_AUTH_URL=http://localhost:3000`.
3. Update `apps/server/.env.example` with the new key names (values blank).

**Why not in code/git:** the Client Secret is a *server credential* — whoever holds it can impersonate our app to Google. Git history is forever (a later "remove secrets" commit doesn't unpublish them), and anything shipped to the browser bundle (`VITE_*`) is public by definition. So: secret lives only in the server's env file, out of version control; the *Client ID* is public by design (it's visible in the redirect URL) but we keep it in env too for consistency. This repo has already been burned once by leaked prod secrets — the lesson is institutional now.

## Phase 2 — Server: better-auth instance + mount

**New `apps/server/src/shared/config/auth.ts`:**

```ts
betterAuth({
  database: mongodbAdapter(db),          // dedicated MongoClient on MONGODB_URI
  emailAndPassword: { enabled: true },
  socialProviders: {
    google: { clientId: env.GOOGLE_CLIENT_ID, clientSecret: env.GOOGLE_CLIENT_SECRET },
  },
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  trustedOrigins: ['http://localhost:5173'],
  user: { additionalFields: { role: { type: 'string', defaultValue: 'user' } } },
})
```

- **DB:** a dedicated `MongoClient` (from the `mongodb` package, already a dep) on the same `MONGODB_URI` — the documented adapter pattern, and it sidesteps "auth needs a `Db` before mongoose has connected" ordering problems. Mongo needs no schema migration; better-auth creates its collections on first use.
- **`role` survives as a better-auth `additionalField`** (default `'user'`) so the `@repo/shared` `User` contract and `req.user.role` keep working. No enforcement is added — same as today.
- **Mount order in `app.ts` matters:**
  1. `cors({ origin: 'http://localhost:5173', credentials: true })` (already correct)
  2. `app.all('/api/auth/*splat', toNodeHandler(auth))` — Express 5 wildcard syntax; **must come before `express.json()`** because the handler reads the raw request body
  3. `express.json()`, rate limiter, `/api/tasks`, `/api/posts`, swagger, SPA fallback — unchanged
- `env.ts`: drop `JWT_SECRET`/`REFRESH_TOKEN_SECRET`; add the four new vars (all `requireEnv`).

### The middleware rewrite (`authenticate.ts`)

Same file, same contract, new engine: instead of `jwt.verify(token)`, call

```ts
const session = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) })
```

No session → `UnauthorizedError` (401). Session → `req.user = { userId: session.user.id, email: session.user.email, role: session.user.role }`. Because `req.user`'s shape is preserved, **task/post controllers, services, and the `userId` scoping don't change at all.**

### Deletions

- `modules/auth/` entirely (service, controller, routes, dto, `refresh-token.schema.ts`; `auth.types.ts`'s `JwtPayload` becomes a plain `AuthUser` type or moves next to the middleware).
- `modules/user/` entirely — better-auth owns the `user` collection now (`UserRole` already comes from `@repo/shared`).
- Dependencies: `jsonwebtoken`, `bcrypt`, `@types/*` for both (nothing else uses them). Also removes the `allowBuilds` bcrypt entry's reason for existing — leave `pnpm-workspace.yaml` cleanup to the plan.
- Swagger docs for the old auth endpoints.

### Small but load-bearing follow-ons

- **Move `mongodb` from `devDependencies` to `dependencies`** — today it's dev-only (used just for types), but `mongodbAdapter` needs the driver at runtime; a pruned prod image would crash on boot without this.
- `task.schema.ts`: drop the now-dangling `ref: 'User'` on `userId` (no `populate` anywhere; the mongoose `User` model is deleted). better-auth's Mongo adapter uses `ObjectId` ids, so the hex-string `session.user.id` still casts cleanly into the existing `ObjectId` field.
- `shared/types/express.d.ts` imports `JwtPayload` from the deleted module — repoint it at the replacement `AuthUser` type.
- **Rate limiting (accepted gap):** the better-auth handler mounts *before* `limiter`, so express-rate-limit no longer covers auth endpoints. better-auth ships its own rate limiting (enabled by default in production) — rely on that.
- Two findings from the 2026-07-03 security review are subsumed for free: the login **user-enumeration** leak ('Invalid email' vs 'Invalid password' — better-auth returns uniform credential errors) and the **localStorage-token XSS exposure** (cookie sessions).

## Phase 3 — Web: login screen + auth client

- **`src/lib/authClient.ts`:** `createAuthClient` from `better-auth/react` with `baseURL: new URL(import.meta.env.VITE_API_BASE_URL + '/auth', window.location.origin).href` — dev resolves to `http://localhost:3000/api/auth`, prod's relative `/api` resolves against the page origin to `<origin>/api/auth` (better-auth accepts a baseURL that includes the basePath).
- **New `src/routes/login.tsx`** (the only public route), retro-arcade styling per `PRODUCT.md`:
  - Primary: **"Connect via Google"** → `authClient.signIn.social({ provider: 'google', callbackURL: \`${window.location.origin}/tasks\` })`. **The callbackURL must be absolute in dev:** the Google callback lands on the *server* (`:3000`), so a relative `/tasks` would redirect to `localhost:3000/tasks` — which serves nothing in dev (the SPA lives on `:5173`; only prod serves it from Express). `window.location.origin` yields the right origin in both envs, and `:5173` is already in `trustedOrigins`.
  - Secondary: email/password form with sign-in/sign-up toggle (`authClient.signIn.email` / `signUp.email`)
- **`src/lib/api.ts` rewrite:** delete `login()`, `ensureLogin`, the localStorage token, the request interceptor, and the 401 auto-relogin. Replace with `withCredentials: true` (the session cookie rides along automatically) and a 401 response interceptor that redirects to `/login`.
- **Header:** show the signed-in user (name/avatar from the session — Google supplies both) + a **Sign out** button (`authClient.signOut()` → redirect to `/login`).
- Web env: `VITE_DEV_EMAIL`/`VITE_DEV_PASSWORD` deleted from `.env.local` and `.env.example`.

## Phase 4 — Session & user creation (better-auth does this)

Nothing to build — this phase is *understanding*. On the Google callback, better-auth exchanges the code, verifies Google's ID token, then **find-or-creates** the user: match by email → link a `google` row in `account` → create a `session` row → set the httpOnly session cookie → redirect to `callbackURL`. Email/password sign-up writes a `credential` row in `account` instead. One `user` document either way; the same person can later hold both login methods.

## Phase 5 — Route protection

- **Server (security):** the rewritten `authenticate` middleware, already applied to `/api/tasks` (and posts). Unauthenticated API calls → 401. This is the real boundary.
- **Client (UX):** `beforeLoad` guard in `__root.tsx` — fetch the session (`authClient.getSession()`); no session and not on `/login` → `redirect({ to: '/login' })`; has session and on `/login` → redirect to `/tasks`. With only one public route, a root-level guard with a one-entry allowlist beats restructuring every route file under a `_authed` pathless layout.
- The todo store `init()` moves out of `__root` (it would fire a doomed `/tasks` fetch on the login screen) into the tasks route.

## Testing

- **Unit:** rewritten `authenticate` — session present → `req.user` populated + `next()`; absent → 401 — with `auth.api.getSession` mocked. Existing task service/cache tests unaffected.
- **E2E reality check:** the existing suite does **not** hit a real API — `e2e/helpers/mockTasksApi.ts` intercepts `**/auth/login` and `**/tasks` at the network layer, and Playwright's `webServer` starts only Vite. The spec keeps that pattern:
  - `mockTasksApi` swaps its `/auth/login` stub for a **`GET /api/auth/get-session` stub** returning a fake session (that's the one endpoint the root guard calls).
  - **Every existing spec needs the session stub — including `counter.spec.ts`** — because the whole-app guard now fronts every route. This is the biggest blast radius of the guard decision.
  - One new spec covers the login screen itself: unauthenticated visit → redirected to `/login`; both buttons render; mocked sign-in → lands on `/tasks`.
- **Real-flow verification is manual, once:** email/password sign-up against the running server, and the Google flow (click the button, consent, land on `/tasks`, then inspect the `user`/`account`/`session` collections in Mongo). A real-server auth e2e (API + Mongo in `webServer`) is deliberately out of scope — new infra for marginal coverage.

## Ops notes

- **Dev cookies work as-is:** `localhost:5173` ↔ `localhost:3000` is same-site (`SameSite=Lax` suffices) — the pain starts only with cross-*domain* setups, which we don't have.
- **Prod:** same-origin (Express serves the SPA), so cookies are trivially fine. Needs `BETTER_AUTH_URL=<prod origin>`, a prod redirect URI added in the Google console, and secrets injected via the deploy pipeline (SSM/env — *not* the image). No live prod environment exists right now (EC2 gone; ECR image only), so this is a checklist for later, not work now.
- **Docs that must move with the code** (all describe the old auth today): root `README.md` (the "JWT API" label, the dev-credentials setup line, and the shared-contract list — `loginBodySchema`/`authTokensSchema` die with this change), `CLAUDE.md`'s "Backend API contract" section (dev auto-login, localStorage token, known-gap note), both `.env.example` files, and the swagger spec. README additionally gains the four questions below.

## The four assignment questions (answers to land in README)

1. **Redirect → callback → token exchange.** *Redirect:* the SPA button sends the browser to Google's consent page with our `client_id`, requested scopes, `redirect_uri`, and a `state` value (CSRF protection, generated and remembered by better-auth). *Callback:* after consent Google sends the browser to `http://localhost:3000/api/auth/callback/google?code=…&state=…` — note the browser only ever carries a short-lived, one-time **code**, never tokens. *Token exchange:* better-auth (server-side) POSTs `code + client_id + client_secret` directly to Google; Google returns ID/access tokens; better-auth verifies the ID token, find-or-creates the user, opens a session, sets the cookie. The secret never touches the browser; tokens never ride in URLs.
2. **Where does the Client Secret live and why not code/git?** `apps/server/.env/.env.dev`, gitignored; prod gets it from deploy-time env injection. Git history is permanent and this repo's history is public — a secret committed once is compromised forever (we've lived this). Anything in the client bundle is public too, so it can never be a `VITE_*` var.
3. **What does better-auth replace?** Everything `modules/auth/` + `refresh-token.schema.ts` + half of `user.service.ts` hand-rolled: password hashing, token/session issuance *and storage*, expiry/rotation, the entire OAuth dance (state/CSRF, code exchange, ID-token verification, account linking), cookie handling, and the client SDK. We keep exactly one job: asking "who is this?" via `getSession` in one middleware. Fewer moving parts we can get subtly wrong (our old refresh flow had no rotation, tokens sat in localStorage readable by any XSS).
4. **Identity vs authorization.** Google only answers *"who is this?"* — authentication (a verified email/name/avatar). What that person may *do here* — which tasks they see, whether `role: 'admin'` means anything — is authorization, and it's 100% our app's decision; Google has no say. Concretely: Google identifies you, then *our* DB row (`user.role`, task `userId` scoping) decides what you're allowed to touch. The `account` collection is the hinge where an external identity is bound to a local user with local permissions.

## Out of scope

- User/task data migration from the old collections (fresh start).
- Role *enforcement* (still nothing checks `role` — unchanged from today).
- Additional providers, email verification, password reset, prod deployment work.
