# React Intro — pnpm + Turborepo monorepo

Two formerly separate repos — a React SPA and an Express API — unified into one monorepo with a shared, single-source-of-truth contract package.

```
├─ apps/
│  ├─ web/        @repo/web     — React 19 + Vite SPA (counter, tic-tac-toe, todo)
│  └─ server/     @repo/server  — Express 5 + Mongoose API, auth via better-auth (Google OAuth + email/password, cookie sessions); history preserved via git subtree
├─ packages/
│  └─ shared/     @repo/shared  — zod schemas + inferred types: the API contract
├─ pnpm-workspace.yaml           — workspace definition (apps/*, packages/*)
├─ turbo.json                    — task graph: build/dev/lint/typecheck/test
└─ .github/workflows/            — unified CI + deploy (Docker image → ECR)
```

## Getting started

Requires Node 24 (`.nvmrc`) and corepack (pins pnpm via `packageManager`).

```bash
corepack enable
pnpm install
pnpm dev          # turbo run dev — builds @repo/shared, then web (5173) + server (3000) in parallel
```

The web app expects `apps/web/.env.local` with `VITE_API_BASE_URL=http://localhost:3000/api`; sign in via Google or email/password on the `/login` screen. The server needs Google OAuth credentials + a better-auth secret plus its other env (see `apps/server/.env.example`) and a reachable MongoDB; Redis is optional (falls back to no cache).

| Task                 | Command                                      |
| -------------------- | -------------------------------------------- |
| Dev (both apps)      | `pnpm dev`                                   |
| Build everything     | `pnpm build`                                 |
| Lint/typecheck/tests | `pnpm lint` · `pnpm typecheck` · `pnpm test` |
| Single package       | `pnpm --filter @repo/server test`            |
| E2E (Playwright)     | `pnpm --filter @repo/web test:e2e`           |

## Production shape

One Docker image (`apps/server/Dockerfile`, built from the repo root) contains all three builds: Express serves the API under **`/api`** and the web's static build for everything else (SPA fallback), so the deployed app is same-origin — no CORS. CI (`.github/workflows/ci.yml`) runs `turbo run lint typecheck test build` on every PR; `deploy.yml` builds and pushes the image to ECR on every push to `main`.

---

## Design notes (the assignment's questions)

### What lives in `packages/shared`, and why is it better than duplication?

Only the **public API contract**: `taskSchema`/`Task`, `createTaskBodySchema`, `updateTaskBodySchema`, and `userPublicSchema`/`User` (+ `UserRole`). Each export is a **zod schema plus its `z.infer` type**, so one definition provides both compile-time types and runtime validation. Deliberately _not_ in shared: server internals — mongoose schemas, `UserEntity.password`, `TaskEntity.userId`.

Versus duplication: before the merge, the web's `Task` and the server's `TaskEntity` had already silently drifted apart. With one shared definition, a contract change becomes a **compile error** on whichever side lags instead of a runtime surprise; and both sides can validate with the very same schema the other side was typed against.

### What does Turborepo add beyond pnpm workspaces?

Workspaces only **link** packages: `@repo/shared` is symlinked into each app's `node_modules` from one root lockfile. Turborepo adds **task orchestration** on top:

- **Dependency graph** — `build` depends on `^build`, so `@repo/shared` always builds before the apps, declared once in `turbo.json`.
- **Caching** — unchanged packages replay their previous output (`>>> FULL TURBO`) instead of rebuilding/retesting.
- **Parallelism + fan-out** — `turbo run dev` starts both apps; `turbo run lint typecheck test build` runs everything in the right order with one command.

### Monolith or microservices? Did the migration change the architecture?

Neither — it's a **two-tier client/server app**: one SPA + one API service talking over HTTP (the API itself is a single monolithic service). The migration changed **repository topology, not runtime architecture**: monorepo-vs-polyrepo is orthogonal to monolith-vs-microservices. There are still exactly two deployable units with the same boundary between them; they just share one repo, one lockfile, one CI, and one contract package now.

### How does each app point to `packages/shared`?

Via the pnpm **workspace protocol**: both apps declare `"@repo/shared": "workspace:*"`, which pnpm resolves to a symlink into `packages/shared`. It's a **built** package — `main`/`types`/`exports` point at `dist/`, and Turbo's `^build` guarantees `dist` exists before an app compiles. The server (TS `nodenext`) consumes the emitted `.js` + `.d.ts`; the web (Vite/bundler resolution) consumes the same entry point. Imports look identical on both sides: `import type { Task } from '@repo/shared'`.

---

## Design notes (the Google OAuth / better-auth assignment's questions)

### Walk through the OAuth flow: redirect → callback → token exchange

_Redirect:_ the SPA's "Sign in with Google" button sends the browser to Google's consent page with our `client_id`, requested scopes, `redirect_uri`, and a `state` value (CSRF protection, generated and remembered by better-auth). _Callback:_ after consent, Google sends the browser to `/api/auth/callback/google?code=…&state=…` — note the browser only ever carries a short-lived, one-time **code**, never tokens. _Token exchange:_ better-auth (server-side) POSTs `code + client_id + client_secret` directly to Google; Google returns ID/access tokens; better-auth verifies the ID token, find-or-creates the user, opens a session, and sets the cookie. The secret never touches the browser; tokens never ride in URLs.

### Where does the Client Secret live, and why not in code/git?

In `apps/server/.env` (gitignored — see `apps/server/.env.example`); prod gets it from deploy-time env injection. Git history is permanent and this repo's history is public — a secret committed once is compromised forever (we've lived this). Anything in the client bundle is public too, so it can never be a `VITE_*` var.

### What does better-auth replace?

Everything the old hand-rolled `modules/auth/` + refresh-token schema + half of the user service did: password hashing, token/session issuance _and storage_, expiry/rotation, the entire OAuth dance (state/CSRF, code exchange, ID-token verification, account linking), cookie handling, and the client SDK. We keep exactly one job: asking "who is this?" via `getSession` in one middleware. Fewer moving parts we can get subtly wrong (our old refresh flow had no rotation, and tokens sat in localStorage readable by any XSS).

### Identity vs authorization

Google only answers _"who is this?"_ — authentication (a verified email/name/avatar). What that person may _do here_ — which tasks they see, whether `role: 'admin'` means anything — is authorization, and it's 100% our app's decision; Google has no say. Concretely: Google identifies you, then _our_ DB row (`user.role`, task `userId` scoping) decides what you're allowed to touch. The `account` collection is the hinge where an external identity is bound to a local user with local permissions.
