# README Project Overview Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure `README.md` to describe the overall project; relocate the two assignment Q&A sections to `docs/assignments/`.

**Architecture:** Docs-only, three files. Move first, then rewrite: the two Q&A sections are copied verbatim into `docs/assignments/` *before* the README is rewritten, so no content is ever lost mid-pipeline. The README keeps its verified top half (layout tree, getting started, commands, production shape) and gains four project-wide sections per the spec.

**Tech Stack:** Markdown, Prettier (`pnpm format:check`), git.

**Context:** Spec at `docs/superpowers/specs/2026-07-10-readme-project-overview-design.md`. One fact-check correction discovered at plan time: the compose file lives at `apps/server/docker-compose.yml` and provides **Redis, RabbitMQ, Mailpit only — no MongoDB** (Mongo comes from `MONGODB_URI`, default `mongodb://localhost:27017/server_dev`). The README's dev-services section below reflects reality, not the spec's wording.

**Line-range references** below are to `README.md` as of commit `457ffb4`.

---

### Task 1: Create `docs/assignments/monorepo-migration.md`

**Files:**
- Create: `docs/assignments/monorepo-migration.md`

- [ ] **Step 1: Create the file**

Start with this header:

```markdown
# Assignment write-up — polyrepo → Turborepo monorepo

Q&A answers for the monorepo-migration assignment (see the matching spec/plan in `../superpowers/`). Moved verbatim from the README on 2026-07-10.
```

Then append, **verbatim**, the body of README section "Design notes (the assignment's questions)" — `README.md` lines 44–64 (the four `###` Q&A blocks, from "### What lives in `packages/shared`…" through the `import type { Task } from '@repo/shared'` paragraph). Do not include the `## Design notes …` line itself or the `---` separators.

- [ ] **Step 2: Commit**

```bash
git add docs/assignments/monorepo-migration.md
git commit -m "docs: move monorepo assignment Q&A out of README"
```

### Task 2: Create `docs/assignments/google-oauth-better-auth.md`

**Files:**
- Create: `docs/assignments/google-oauth-better-auth.md`

- [ ] **Step 1: Create the file**

Header:

```markdown
# Assignment write-up — Google OAuth via better-auth

Q&A answers for the Google OAuth / better-auth assignment (see the matching spec/plan in `../superpowers/`). Moved verbatim from the README on 2026-07-10.
```

Then append, **verbatim**, the body of README section "Design notes (the Google OAuth / better-auth assignment's questions)" — `README.md` lines 70–84 (the four `###` Q&A blocks, from "### Walk through the OAuth flow…" through the "Identity vs authorization" paragraph). Do not include the `## Design notes …` line itself.

- [ ] **Step 2: Commit**

```bash
git add docs/assignments/google-oauth-better-auth.md
git commit -m "docs: move OAuth assignment Q&A out of README"
```

### Task 3: Rewrite `README.md`

**Files:**
- Modify: `README.md` (full-file replacement)

- [ ] **Step 1: Replace README.md with exactly this content**

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: README describes the whole project; assignment Q&A linked from docs/"
```

### Task 4: Verify

**Files:** none (checks only)

- [ ] **Step 1: Prettier check on touched files**

Run from the repo root: `pnpm format:check`
Expected: PASS (exit 0). If Prettier complains about the new files, run `pnpm format`, re-check, and amend the last commit.

- [ ] **Step 2: Verify every relative link resolves**

```bash
cd /Users/nadavramon/fullstack_projects/React_Intro
grep -oE '\]\(([^)#]+)\)' README.md docs/assignments/*.md | sed -E 's/^([^:]+):\]\((.*)\)/\1 \2/' | while read src target; do
  case "$target" in http*) continue;; esac
  base=$(dirname "$src")
  [ -e "$base/$target" ] || [ -e "$target" ] || echo "BROKEN: $src -> $target"
done
```

Expected: no `BROKEN:` lines.

- [ ] **Step 3: Confirm the move left nothing behind**

Run: `grep -c "Design notes" README.md || true`
Expected: `0`. Also confirm both Q&A files exist: `ls docs/assignments/`.

- [ ] **Step 4: Final commit if verification touched anything**

```bash
git status --short   # expect clean; if format fixed files, commit them:
# git add -A && git commit -m "docs: prettier fixes"
```

---

## Verification (end-to-end)

- `pnpm format:check` passes.
- Link-check loop above prints nothing.
- `README.md` contains no "Design notes" sections; `docs/assignments/` contains both write-ups with the Q&A bodies byte-identical to the old README sections (spot-check with `git show 457ffb4:README.md`).
- No code touched, so `/check`'s lint/typecheck/test are unaffected (CI will confirm).
