# React Intro — pnpm + Turborepo monorepo

Two formerly separate repos — a React SPA and an Express API — unified into one monorepo with a shared, single-source-of-truth contract package.

```
├─ apps/
│  ├─ web/        @repo/web     — React 19 + Vite SPA (counter, tic-tac-toe, todo)
│  └─ server/     @repo/server  — Express 5 + Mongoose + JWT API (history preserved via git subtree)
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

The web app expects `apps/web/.env.local` with `VITE_API_BASE_URL=http://localhost:3000/api` (plus dev login credentials — see `.env.example`). The server needs its own env (`apps/server/.env.example`) and a reachable MongoDB; Redis is optional (falls back to no cache).

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

Only the **public API contract**: `taskSchema`/`Task`, `createTaskBodySchema`, `updateTaskBodySchema`, `loginBodySchema`, `authTokensSchema`/`AuthTokens`, and `userPublicSchema`/`User` (+ `UserRole`). Each export is a **zod schema plus its `z.infer` type**, so one definition provides both compile-time types and runtime validation. Deliberately _not_ in shared: server internals — mongoose schemas, `UserEntity.password`, `TaskEntity.userId`.

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
