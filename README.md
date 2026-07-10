# React Intro — pnpm + Turborepo monorepo

A learning sandbox that outgrew its name: what started as a React intro exercise is now a production-shaped monorepo — a React 19 SPA, an Express 5 API, and a shared zod contract package, unified from two formerly separate repos (server history preserved via `git subtree`).

## What the app does

- **Web** (`apps/web`) — a React SPA with three features: a counter and a tic-tac-toe game (early exercises), and the main event — an auth-gated, per-user **todo app**.
- **Server** (`apps/server`) — the API behind it: tasks REST endpoints (swagger at `/api/api-docs`), auth via **better-auth** (Google OAuth + email/password, httpOnly cookie sessions), **Redis** cache-aside on task reads, a **RabbitMQ** welcome-mail queue delivered to a **Mailpit** dev inbox, and a soft-delete cleanup cron.
- **Contract** (`packages/shared`) — zod schemas + inferred types shared by both sides, so an API change is a compile error, not a runtime surprise.

## Workspace layout

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

The web app expects `apps/web/.env.local` with `VITE_API_BASE_URL=http://localhost:3000/api`; sign in via Google or email/password on the `/login` screen. The server needs Google OAuth credentials + a better-auth secret plus its other env (see `apps/server/.env.example`) and a reachable MongoDB.

### Dev services

```bash
cd apps/server && docker compose up -d   # Redis, RabbitMQ, Mailpit
```

MongoDB is **not** in the compose file — point `MONGODB_URI` at a local `mongod` or Atlas. Redis and RabbitMQ are optional: without them the server runs with no cache and skips the queued welcome mail. Mailpit's web inbox is at `http://localhost:8025`; RabbitMQ's management UI at `http://localhost:15672` (guest/guest).

| Task                 | Command                                      |
| -------------------- | -------------------------------------------- |
| Dev (both apps)      | `pnpm dev`                                   |
| Build everything     | `pnpm build`                                 |
| Lint/typecheck/tests | `pnpm lint` · `pnpm typecheck` · `pnpm test` |
| Single package       | `pnpm --filter @repo/server test`            |
| E2E (Playwright)     | `pnpm --filter @repo/web test:e2e`           |

## Production shape

One Docker image (`apps/server/Dockerfile`, built from the repo root) contains all three builds: Express serves the API under **`/api`** and the web's static build for everything else (SPA fallback), so the deployed app is same-origin — no CORS. CI (`.github/workflows/ci.yml`) runs `turbo run lint typecheck test build` on every PR; `deploy.yml` builds and pushes the image to ECR on every push to `main`.

## How this repo is built

Non-trivial features flow through a spec-driven pipeline (`/specify → /plan → /implement → /retro`): each phase reads the previous artifact from disk and writes its own, so state survives context resets. [`docs/superpowers/INDEX.md`](docs/superpowers/INDEX.md) is the manifest of every feature, its spec, plan, and status — effectively the project's changelog with design rationale attached.

## Assignment write-ups

Q&A design notes for individual course assignments live in [`docs/assignments/`](docs/assignments/).
