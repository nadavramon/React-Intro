# React_Intro (monorepo)

A learning sandbox, now a **pnpm + Turborepo monorepo**: the React app (`apps/web`), the Express API (`apps/server`), and their shared zod contract (`packages/shared`) live in one repo. Code quality matters here, but the primary goal is learning — favor clarity and explanation over cleverness.

## Commands (run from the repo root)

| Task                        | Command                                                                      |
| --------------------------- | ---------------------------------------------------------------------------- |
| Dev (both apps in parallel) | `pnpm dev` (`turbo run dev` — builds `@repo/shared` first)                   |
| Build everything            | `pnpm build`                                                                 |
| Lint / typecheck / tests    | `pnpm lint` / `pnpm typecheck` / `pnpm test` (all fan out via Turbo)         |
| Format (write / check)      | `pnpm format` / `pnpm format:check`                                          |
| One package only            | `pnpm --filter @repo/web <script>` (same for `@repo/server`, `@repo/shared`) |
| E2E tests (real browser)    | `pnpm --filter @repo/web test:e2e`                                           |

pnpm is pinned via corepack (`packageManager` in the root `package.json`); Node 24 (`.nvmrc`). One lockfile at the root — never create per-package lockfiles. pnpm 11 note: native deps build only if listed in `allowBuilds` in `pnpm-workspace.yaml` (bcrypt, esbuild).

## Workspace layout

- **`apps/web`** (`@repo/web`) — the React SPA (counter, tic-tac-toe, todo features).
- **`apps/server`** (`@repo/server`) — Express 5 + Mongoose API, auth via better-auth. Grafted from the old standalone `server` repo via `git subtree` (its history is preserved here).
- **`packages/shared`** (`@repo/shared`) — the API contract: zod schemas + `z.infer` types (`Task`, `User`, create/update bodies). **Built** package: apps consume `dist/`, Turbo builds it before them. Contract only — server internals (mongoose schemas, `password`, `userId`) never go here.
- Apps depend on it via `"@repo/shared": "workspace:*"`. Rule: a type that crosses the HTTP boundary lives in shared; each side re-exports under its local names if needed (see `apps/server/src/modules/task/task.dto.ts`).

## Stack

- **Web:** React 19 + TypeScript (strict), Vite, TanStack Router (file-based; `src/routes/` → generated `routeTree.gen.ts`), Tailwind CSS v4 + shadcn/radix-ui (some older features still use CSS Modules), `clsx`/`tailwind-merge` (`cn()` in `src/lib/utils.ts`), axios (`src/lib/api.ts`), zustand.
- **Server:** Express 5 (note: bare `'*'` routes throw under path-to-regexp v8 — use a RegExp), Mongoose, better-auth (Google + email/password, cookie sessions), zod validation, ioredis cache (optional — degrades to no-cache), RabbitMQ via amqplib + Mailpit SMTP sink for the welcome-mail queue (`modules/mail/`; dev services via `docker compose up -d`), winston. `module: nodenext`; `declaration: false` (it's an app, not a library — also avoids TS2883 under pnpm).
- **Tests:** Vitest (+ RTL/jsdom in web); Playwright for e2e.

## Web app architecture (`apps/web/src/`)

- **`features/<name>/`** — self-contained (components, hooks, logic, types), public surface via `index.ts`. Import features through their `index.ts`, not deep paths.
- **`layout/`** — app shell (`Header`, `Sidebar`, `Layout`). **`pages/`** — route-level pages. **`lib/`** — shared helpers (`api.ts`, `utils.ts`).
- **`routes/`** — file-based routes (`__root.tsx` owns the shell); the router plugin emits `src/routeTree.gen.ts` (lint/format-ignored). `src/routes.ts` (`ROUTES` map) is kept for nav-item paths.
- **Path alias:** `@/` → `apps/web/src/` (in `tsconfig.app.json` + `vite.config.ts`).

## Conventions

- **Formatting is Prettier's job.** Format-on-save is enabled; do not hand-tune whitespace, quotes, or semicolons. Each package resolves its nearest Prettier config (web: single quotes/no semis; server: its `.prettierrc`); root `.prettierignore` covers lockfile/dist/generated. Braceless single-statement `if`/`else` is allowed.
- **ESLint** runs in the web app only (`eslint.config.js`, react-hooks + react-refresh); the server's `lint` script is a placeholder.
- Prefer named exports; co-locate a feature's types in its own `types.ts` (which may just re-export from `@repo/shared`).

## Testing

- **Unit / component** — Vitest specs next to the source (`*.test.ts(x)`); web setup in `src/test/setup.ts`. Run all: `pnpm test`; one package: `pnpm --filter @repo/server test`.
- **E2E** — Playwright, `apps/web/e2e/*.spec.ts`; config auto-starts the Vite dev server (`pnpm dev`). E2E is fully network-mocked (`mockTasksApi` + a `get-session` stub) — no API server or Mongo needed; only manual verification needs live servers.
- **Browser verification — prefer the CLI, not the MCP.** To _verify_ known behavior, write/run a Playwright spec. Reserve the Playwright MCP for open-ended _exploration_.

## Project tooling (Claude Code)

- **`/check`** runs format:check + `turbo run lint typecheck test`; **`/check --e2e`** adds the browser tests.
- **`/scaffold-feature <name>`** generates a new `apps/web/src/features/<name>/` folder.
- A `PostToolUse` hook typechecks after any `.ts/.tsx` edit (monorepo-aware: uses `pnpm turbo run typecheck`).

## Spec-driven workflow (SDD pipeline)

Non-trivial features flow through four rerunnable commands. Each reads the prior artifact from disk and writes its own — so state lives in files, not the conversation. **Rerunnable = context-rot-survivable:** `/clear` any time, rerun the command, and the file reloads the slice you need.

| Step | Command            | Reads → Writes                                                       | Runs                                    |
| ---- | ------------------ | -------------------------------------------------------------------- | --------------------------------------- |
| 1    | `/specify <idea>`  | idea → `docs/superpowers/specs/<date>-<topic>-design.md`             | brainstorming skill, live in main       |
| 2    | `/plan [slug]`     | spec → `docs/superpowers/plans/<date>-<topic>-plan.md`               | writing-plans + plan mode, live in main |
| 3    | `/implement [N-M]` | plan checkboxes → code, ticks boxes, journals                        | fan-out subagents, foreground           |
| 4    | `/retro [feature]` | journal + plan + diff → `LESSONS.md` + routed tooling/memory changes | review, live in main                    |

- **This file (`CLAUDE.md`) is the constitution** — the standing rules every phase inherits. No separate command; it's loaded every session.
- **`docs/superpowers/INDEX.md`** — manifest of every feature and its spec/plan/status. The discoverability anchor.
- **`docs/superpowers/JOURNAL.md`** — append-only debug trail; every command logs what it did. Phase boundaries are debug seams: one file in, one file out, so a wrong output tells you exactly which phase to rerun.
- Judgment phases (`/specify`, `/plan`) stay live so you can steer; execution (`/implement`) fans out to subagents that return a tight digest while full detail lands on disk. Subagents never edit the plan file — checkbox state is the orchestrator's.
- Plan tasks may carry `**Skills:**`/`**Agent:**`/`**Model:**` equipment tags; `/implement` dispatches each task's subagent accordingly (see the `writing-plans` skill).
- After a feature is `Done`, `/retro` turns its mistakes into tooling/memory changes (approval-gated) so the pipeline itself gets sharper — `docs/superpowers/LESSONS.md` is the running record.

## Backend API contract

The todo feature talks to `apps/server` (same repo). Client in `apps/web/src/features/todo/api/tasksApi.ts`, axios instance in `apps/web/src/lib/api.ts`. **The contract types/schemas live in `@repo/shared` — change them there, both sides feel it at compile time.**

- **The API is mounted under `/api`** (`/health` stays at root). Base URL from `VITE_API_BASE_URL`: dev `http://localhost:3000/api` (`.env.local`), prod `/api` (same-origin; `.env.production`). `VITE_*` values are baked at build time.
- **Auth is better-auth** at `/api/auth/*` via `toNodeHandler`, mounted **before** `express.json()` — a hard constraint: better-auth reads the raw body, so anyone editing `app.ts` must keep that ordering.
- The web holds the session in an **httpOnly cookie** (axios `withCredentials: true`); there is no token in `localStorage` and no dev auto-login — `VITE_DEV_EMAIL` / `VITE_DEV_PASSWORD` are gone. Sign in at `/login` (Google or email/password); the whole app sits behind a root `beforeLoad` guard.
- **Task shape:** `{ id: string; title: string; isCompleted: boolean }` — `title` (not `text`), `isCompleted` (not `done`).
- Endpoints: `GET/POST /api/tasks`, `PUT/DELETE /api/tasks/:id`, swagger at `/api/api-docs`. Auth endpoints are better-auth's, under `/api/auth/*` (e.g. `sign-in/email`, `sign-up/email`, `callback/google`, `get-session`).
- In prod the Express server also serves the web build (`apps/web/dist`) with an SPA fallback for non-`/api` paths — one deployable image (see `apps/server/Dockerfile`; CI pushes it to ECR on `main`).

## Working style

This is a learning project. When implementing features, prefer explaining the _why_ and, where useful, writing out steps the way a tutorial would rather than silently applying large edits. Introduce concepts in their verbose form first; compaction comes later once understood.

## Design context

Design work uses the `impeccable` skill. Full strategic context is in `apps/web/PRODUCT.md` (and visual system in `DESIGN.md` when present).

- **Register:** product (a tool, but one with a deliberate point of view).
- **Direction:** bold & distinctive, **retro-arcade**; playful, not childish; commit to the aesthetic rather than piling on decoration.
- **Avoid:** generic SaaS dashboards, untouched shadcn/Tailwind defaults, corporate-stiff, overdesigned/cluttered.
- **Accessibility:** WCAG AA, full keyboard nav, honor `prefers-reduced-motion`; never rely on color alone to convey state.
