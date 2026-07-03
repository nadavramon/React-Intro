# Design: Polyrepo → Turborepo Monorepo

- **Date:** 2026-06-30
- **Status:** Spec'd
- **Topic slug:** polyrepo-to-monorepo

## Goal

Unify the two existing repos — `React-Intro` (React + Vite SPA) and `server`
(Express + Mongoose + JWT API) — into a single **pnpm + Turborepo** monorepo,
with a shared types/contract package as the single source of truth instead of
the current hand-duplicated types.

## Conceptual framing (the questions the assignment poses)

### Is this a monolith or microservices? Does the move change the architecture?

Neither. Today the system is a **two-tier client/server app**: one React SPA +
one Express API, deployed as two units, talking over HTTP. The server itself is
a single (monolithic) API service — not microservices.

The monorepo migration is a **repository-topology change, not an architecture
change.** Same two deployable units, same boundaries, same network call between
them. Monorepo-vs-polyrepo is *orthogonal* to monolith-vs-microservices: we are
reorganizing **where the code lives**, not **how it runs**. After the move there
are still exactly two services; they just share one repo and one types package.

### What goes in `packages/shared`, and why is that better than duplication?

`packages/shared` holds **only the public API contract** — never the server's
internal entities (no `TaskEntity.userId`, no `UserEntity.password`, no mongoose
schemas). Concretely:

| Export                  | Shape                                        | Source today (duplicated)                         |
| ----------------------- | -------------------------------------------- | ------------------------------------------------- |
| `taskSchema` / `Task`   | `{ id, title, isCompleted }`                 | web `features/todo/types.ts` vs server `TaskEntity`|
| `createTaskBodySchema`  | `{ title, isCompleted? }`                    | server `task.dto.ts` (web has it inline)          |
| `updateTaskBodySchema`  | `{ title?, isCompleted? }` (one required)    | server `task.dto.ts` vs web inline in `tasksApi`  |
| `userPublicSchema`/`User` | `{ id, email, role }` (**no password**)    | server `UserEntity` (web has none)                |
| `loginBodySchema`       | `{ email, password }`                        | inline both sides                                 |
| `authTokensSchema`/`AuthTokens` | `{ accessToken, refreshToken }`      | server `auth.types.ts` vs web inline in `lib/api.ts`|

Each export is a **zod schema plus its `z.infer` type** (schemas are the source
of truth — chosen over plain-TS-only and over a hybrid).

**Pros over duplication:** one definition consumed by both sides → a contract
change becomes a **compile error** on whichever side lags, instead of today's
silent drift (the web `Task` and server `TaskEntity` already differ). No
copy-paste skew; runtime validation is shared (the web can validate API
responses with the same schema the server validates requests with).

### What does Turborepo add beyond pnpm workspaces?

pnpm workspaces alone only **link** packages (symlink `@repo/shared` into each
app's `node_modules`, hoist deps, one lockfile). Turborepo adds **task
orchestration** on top:

- **Task dependency graph** — `build` of an app waits on `build` of `shared`
  (topological ordering), declared once in `turbo.json`.
- **Caching** — an unchanged package is not rebuilt/retested; its prior output
  is replayed. Local now; remote cache available later.
- **Parallelism** — independent tasks across packages run concurrently.
- **One-command fan-out** — `turbo run dev`, `turbo run build`,
  `turbo run lint typecheck test` across the whole repo.

### How does each app point to `packages/shared`?

Via the pnpm **workspace protocol**: each app's `package.json` declares
`"@repo/shared": "workspace:*"`. pnpm symlinks the package into `node_modules`.

- **Dev:** nothing pre-built. The server (`tsx`) and the web (Vite) both read
  `shared`'s TypeScript source directly through the package's `exports` map.
- **Prod build:** `shared` has its own `tsc` build task; Turbo builds it
  **before** the apps (topological order) so the apps consume the emitted
  types/JS.

## Target layout

```
React-Intro/                 (existing repo — becomes the monorepo root)
├─ apps/
│  ├─ web/                   ← current React_Intro src + configs + e2e
│  └─ server/                ← current ../server (history preserved)
├─ packages/
│  └─ shared/                ← @repo/shared: zod schemas + inferred types
├─ pnpm-workspace.yaml       (packages: apps/*, packages/*)
├─ turbo.json
├─ package.json              (root: workspace scripts, shared devtools, packageManager)
├─ .nvmrc                    (single Node version, aligned on 24)
└─ .github/workflows/        (unified CI + deploy)
```

## Decisions

1. **Repo creation — history-preserving, React-Intro as base.**
   React-Intro stays the root (keeps remote, CI secrets, AWS OIDC role, and the
   SDD pipeline / `CLAUDE.md` constitution). Current web code is `git mv`'d into
   `apps/web/`. The server is brought in via **`git subtree add
   --prefix=apps/server <server-remote> main`** so its commit history survives.
   All done on a branch; verify `git log` shows both lineages before pushing.
   This mirrors corporate practice (preserve history, merge into a base repo
   rather than starting empty).

2. **Shared contract = zod schemas as the single source of truth.**
   Public API contract only (see table above). The server's task DTO schemas
   move into `@repo/shared`; the server imports them back. The web gains `zod`
   as a dependency and imports the same schemas/types.

3. **pnpm workspaces.** Both repos migrate npm → pnpm: delete both
   `package-lock.json`, generate one root `pnpm-lock.yaml`; root
   `packageManager: "pnpm@<v>"`; single root `.nvmrc` (Node 24).

4. **Turborepo** for task orchestration + caching (`turbo.json` defines
   `dev`, `build`, `lint`, `typecheck`, `test` with `^build` deps where needed).

5. **Root scripts:** `dev`→`turbo run dev`, `build`→`turbo run build`,
   `lint`/`typecheck`/`test`→`turbo run …`. **Phase 6b:** add the missing
   `typecheck` script to `apps/web` (`tsc -b --noEmit`); `lint` already exists.

6. **CI/CD + deploy — both web and server, automatic on push to main:**
   - **CI** (one root workflow, on PR + push to main): `pnpm/action-setup` +
     `cache: pnpm`, then `turbo run lint typecheck test build`. Replaces the
     duplicated/stale per-repo workflows (the web's current `.github` is a
     broken copy of the server's — it references a `typecheck` script and a
     `server:ci` Docker job the web doesn't have — and gets removed).
   - **Deploy server** → existing EC2 path via SSM (`systemctl restart server`).
   - **Deploy web** → build `apps/web` static assets, sync to **S3 +
     CloudFront** (with cache invalidation), reusing the existing
     `github-deploy` OIDC role + `eu-central-1`.

7. **Testing:** `turbo run test` runs both packages' Vitest suites. Playwright
   **e2e stays a separate, manual task** (it needs the API server up), not part
   of the default CI gauntlet — unchanged from today.

## Risks / assumptions to verify during `/implement`

1. **EC2 server build path (highest risk).** The current deploy is *only*
   `systemctl restart server` over SSM, implying the box already has the code
   and builds/runs it itself (a `git pull` + build in the systemd/deploy setup,
   opaque from this repo). After the move the server lives in `apps/server` and
   depends on `packages/shared`, so **whatever builds it on the box must now do
   a pnpm workspace install + build from the repo root**, not a flat `npm ci` in
   one directory. The server `Dockerfile` (currently `npm ci` of a flat package)
   needs the same treatment. Confirm and update the box-side / Docker build.

2. **S3 + CloudFront infra.** Bucket name, CloudFront distribution, and whether
   the infra is created manually first vs scripted (IaC). Plan should assume
   manual creation + secrets unless told otherwise.

3. **Node version alignment.** Server pins `>=24 <25`; confirm the web's current
   `.nvmrc` value and adopt a single root Node 24 version.

## Out of scope

- No change to runtime architecture (still SPA + single Express API over HTTP).
- No new backend services / no microservices split.
- No remote Turbo cache setup (local cache only for now).
- No rewrite of feature code beyond swapping duplicated types for `@repo/shared`
  imports.
