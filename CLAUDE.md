# React_Intro

A learning sandbox for React + TypeScript. Several small, self-contained apps (counter, tic-tac-toe, todo) live side by side under `src/features/`. Code quality matters here, but the primary goal is learning — favor clarity and explanation over cleverness.

## Commands

| Task                         | Command                                  |
| ---------------------------- | ---------------------------------------- |
| Dev server                   | `npm run dev`                            |
| Build (typecheck + bundle)   | `npm run build` (`tsc -b && vite build`) |
| Lint                         | `npm run lint`                           |
| Format (write)               | `npm run format`                         |
| Format (check)               | `npm run format:check`                   |
| Unit/component tests (watch) | `npm test`                               |
| Unit/component tests (once)  | `npm run test:run`                       |
| E2E tests (real browser)     | `npm run test:e2e`                       |

## Stack

- **React 19** + **TypeScript** (strict), built with **Vite**.
- Routing: **TanStack Router** (file-based; routes live in `src/routes/`, with the tree generated to `routeTree.gen.ts`).
- Styling: **Tailwind CSS v4** (via `@tailwindcss/vite`) + **shadcn/radix-ui** primitives. Some older features still use CSS Modules — both coexist during the Tailwind migration.
- Utilities: `clsx` + `tailwind-merge` (see `cn()` in `src/lib/utils.ts`), `lucide-react` icons.
- HTTP: **axios** (`src/lib/api.ts`).
- Tests: **Vitest** + **React Testing Library** (jsdom) for unit/component; **Playwright** for e2e.

## Architecture

- **`src/features/<name>/`** — each feature is self-contained (components, hooks, logic, types) and exposes a public surface via `index.ts`. Import features through their `index.ts`, not deep paths.
- **`src/layout/`** — app shell (`Header`, `Sidebar`, `Layout`).
- **`src/pages/`** — route-level pages (e.g. `NotFoundPage`).
- **`src/lib/`** — shared, framework-agnostic helpers (`api.ts`, `utils.ts`).
- **`src/routes/`** — file-based routes (one file per route; `__root.tsx` owns the app shell). The `@tanstack/router-plugin` scans this dir and emits the generated `src/routeTree.gen.ts` at the `src` root (lint/format-ignored; kept out of `src/routes/` so the plugin doesn't scan its own output). `src/routes.ts` (the `ROUTES` map) is kept for nav-item paths.

## Conventions

- **Path alias:** `@/` → `src/` (configured in both `tsconfig.app.json` and `vite.config.ts`). Use `@/features/...` over relative climbs.
- **Formatting is Prettier's job.** Format-on-save is enabled; do not hand-tune whitespace, quotes, or semicolons. Braceless single-statement `if`/`else` is allowed.
- **ESLint** is configured (`eslint.config.js`) with the react-hooks and react-refresh plugins; `eslint-config-prettier` disables stylistic rules so the two don't fight.
- Prefer named exports; co-locate a feature's types in its own `types.ts`.

## Testing

Two layers, kept separate (Vitest excludes `e2e/**`):

- **Unit / component** — Vitest + RTL. Specs live next to the source as `*.test.ts(x)` under `src/`. Setup: `src/test/setup.ts` (jest-dom matchers + auto-cleanup). Run with `npm run test:run`.
- **E2E** — Playwright. Specs live in `e2e/*.spec.ts`; config in `playwright.config.ts` auto-starts the dev server. Run with `npm run test:e2e`. Note: the Todo/`/tasks` page needs the Express server running; counters and tic-tac-toe are backend-free.

**Browser verification — prefer the CLI, not the MCP.** To _verify_ known behavior (DOM, styles, console errors, flows), write/run a Playwright spec — its output is compact text. Reserve the Playwright **MCP** (snapshots/screenshots, which cost many tokens) for open-ended _exploration_ ("why does this look wrong?"). Don't reach for the MCP when an assertion would do.

## Project tooling (Claude Code)

- **`/check`** runs lint + typecheck + unit tests; **`/check --e2e`** adds the browser tests.
- **`/scaffold-feature <name>`** generates a new `src/features/<name>/` folder matching the conventions above.
- A `PostToolUse` hook runs `tsc` after any `.ts/.tsx` edit, so type errors surface immediately.

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
- Judgment phases (`/specify`, `/plan`) stay live so you can steer; execution (`/implement`) fans out to subagents that return a tight digest while full detail lands on disk.
- Plan tasks may carry `**Skills:**`/`**Agent:**`/`**Model:**` equipment tags; `/implement` dispatches each task's subagent accordingly (see the `writing-plans` skill).
- After a feature is `Done`, `/retro` turns its mistakes into tooling/memory changes (approval-gated) so the pipeline itself gets sharper — `docs/superpowers/LESSONS.md` is the running record.

## Backend API contract

The todo feature talks to a separate Express + Mongoose + JWT server (`../server`). Client lives in `src/features/todo/api/tasksApi.ts`, axios instance in `src/lib/api.ts`.

- Base URL from `VITE_API_BASE_URL`; dev auth auto-logs-in via `VITE_DEV_EMAIL` / `VITE_DEV_PASSWORD` and stores `accessToken` in `localStorage`. A response interceptor retries once on `401` by re-logging in.
- **Task shape:** `{ id: string; title: string; isCompleted: boolean }`. The server contract uses `title` (not `text`) and `isCompleted` (not `done`) — keep this naming.
- Endpoints: `GET /tasks`, `POST /tasks` (`{ title }`), `PUT /tasks/:id` (`{ title?, isCompleted? }`), `DELETE /tasks/:id`, `POST /auth/login`.

## Working style

This is a learning project. When implementing features, prefer explaining the _why_ and, where useful, writing out steps the way a tutorial would rather than silently applying large edits. Introduce concepts in their verbose form first; compaction comes later once understood.

## Design context

Design work uses the `impeccable` skill. Full strategic context is in `PRODUCT.md` (and visual system in `DESIGN.md` when present).

- **Register:** product (a tool, but one with a deliberate point of view).
- **Direction:** bold & distinctive, **retro-arcade**; playful, not childish; commit to the aesthetic rather than piling on decoration.
- **Avoid:** generic SaaS dashboards, untouched shadcn/Tailwind defaults, corporate-stiff, overdesigned/cluttered.
- **Accessibility:** WCAG AA, full keyboard nav, honor `prefers-reduced-motion`; never rely on color alone to convey state.
