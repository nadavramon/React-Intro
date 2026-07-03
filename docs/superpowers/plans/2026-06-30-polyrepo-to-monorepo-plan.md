# Polyrepo → Turborepo Monorepo Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge `React-Intro` (web) and `server` into one pnpm + Turborepo monorepo with a shared zod-contract package (`@repo/shared`) as the single source of truth, and unified CI + automatic deploy for both apps.

**Architecture:** React-Intro becomes the monorepo root. Web code moves to `apps/web`; the server is grafted into `apps/server` via `git subtree` (history preserved); the public API contract (zod schemas + inferred types) lives in `packages/shared`. Turbo orchestrates `dev`/`build`/`lint`/`typecheck`/`test` with `shared` built before the apps. Still two deployable units — repo topology changes, runtime architecture does not.

**Tech Stack:** pnpm workspaces, Turborepo, zod v4, TypeScript 6, Vite 8 (web), tsx/Express (server), Vitest, GitHub Actions, AWS (single EC2/SSM box runs the API **and** serves the web static build).

**Web hosting:** the Express server serves `apps/web/dist` as static files (SPA catch-all), so there is **one** deploy target — no S3/CloudFront. To avoid the `/tasks` page-vs-API collision, the **API is mounted under `/api`** (`/api/tasks`, `/api/auth`, `/api/posts`); `/health` stays at root for the infra healthcheck; everything else falls through to the SPA's `index.html`. In prod the web uses a same-origin relative `/api` baseURL (no CORS needed); in dev it points at `http://localhost:3000/api`.

**Conventions locked in this plan:**
- Workspace package names: `@repo/web`, `@repo/server`, `@repo/shared`.
- `@repo/shared` is a **built** package (`dist/index.js` + `dist/index.d.ts`); apps consume the build, Turbo builds it first. (Deviation from the spec's "read source directly" — forced by the server's `nodenext` + `declaration: true` setup, which cannot import raw `.ts` from a dependency.)
- Shared schema exports are camelCase (`createTaskBodySchema`); inferred types are PascalCase (`CreateTaskBody`, `Task`, `User`, `AuthTokens`). The server's existing PascalCase DTO names are preserved by aliased re-exports, so controllers/services don't change.
- All work on branch `feat/monorepo-turborepo`. The repo won't `pnpm install`/build cleanly until the workspace is assembled (~Task 7) — that's expected; commit per task anyway.

---

## File map

**Created (root):** `pnpm-workspace.yaml`, `turbo.json`, `package.json` (root), `.nvmrc`, `.github/workflows/ci.yml` (rewritten), `.github/workflows/deploy.yml` (single workflow, both apps).
**Created (`packages/shared/`):** `package.json`, `tsconfig.json`, `src/index.ts`, `src/task.ts`, `src/auth.ts`, `src/user.ts`, `src/task.test.ts`.
**Moved:** all current web files → `apps/web/**`; all current server files → `apps/server/**` (via subtree).
**Modified (web):** `apps/web/package.json` (name, deps, scripts), `apps/web/src/features/todo/types.ts`, `apps/web/src/features/todo/api/tasksApi.ts`, `apps/web/src/lib/api.ts`, `apps/web/.env.example` (baseURL → `/api`).
**Modified (server):** `apps/server/package.json` (name, dep), `apps/server/src/app.ts` (API under `/api` + static SPA serving), `apps/server/src/modules/task/task.dto.ts`, `apps/server/src/modules/auth/auth.dto.ts`, `apps/server/src/modules/auth/auth.types.ts`, `apps/server/src/shared/utils/swagger.ts` (server URL → `/api`), `apps/server/Dockerfile`.
**Deleted:** `apps/web/package-lock.json`, `apps/server/package-lock.json` (replaced by root `pnpm-lock.yaml`); stale duplicate workflows.

---

### Task 1: Branch and relocate web into `apps/web`

**Files:**
- Move: all tracked top-level entries (except keep-list) → `apps/web/`

- [x] **Step 1: Create the migration branch**

```bash
cd /Users/nadavramon/fullstack_projects/React_Intro
git checkout -b feat/monorepo-turborepo
```

- [x] **Step 2: Remove regenerable artifacts so they don't litter the root**

```bash
rm -rf node_modules dist .tanstack .playwright-mcp
```

- [x] **Step 3: Move every tracked top-level entry into apps/web, except the keep-list**

Keep at root: `.github docs .claude CLAUDE.md .gitignore`. Everything else (src, public, index.html, package.json, package-lock.json, configs, e2e, README.md, PRODUCT.md, components.json, env files, etc.) moves.

```bash
mkdir -p apps/web
keep=' .github docs .claude CLAUDE.md .gitignore '
git ls-files | sed 's#/.*##' | sort -u | while read -r top; do
  case "$keep" in *" $top "*) continue ;; esac
  git mv "$top" "apps/web/$top"
done
```

- [x] **Step 4: Verify the move**

Run: `ls apps/web && echo '---' && ls`
Expected: `apps/web` contains `src package.json vite.config.ts tsconfig.json e2e ...`; root now shows only `apps .github docs .claude CLAUDE.md .gitignore` (+ untracked).

- [x] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(monorepo): relocate web app into apps/web

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Root workspace scaffolding (pnpm + Turbo)

**Files:**
- Create: `pnpm-workspace.yaml`, `turbo.json`, `package.json`, `.nvmrc`
- Modify: `.gitignore`
- Delete: `apps/web/package-lock.json`

- [x] **Step 1: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

- [x] **Step 2: Create root `.nvmrc`**

```
24
```

- [x] **Step 3: Create `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true },
    "lint": {},
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] }
  }
}
```

- [x] **Step 4: Create root `package.json`**

```json
{
  "name": "react-intro-monorepo",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "turbo run dev",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  },
  "devDependencies": {
    "prettier": "^3.8.3",
    "turbo": "^2.3.0",
    "typescript": "^6.0.2"
  }
}
```

- [x] **Step 5: Pin the package manager via corepack**

```bash
corepack enable
corepack use pnpm@latest
```
Expected: root `package.json` gains a `"packageManager": "pnpm@<resolved-version>"` field.

- [x] **Step 6: Delete the web npm lockfile and append `.turbo` to `.gitignore`**

```bash
git rm --cached apps/web/package-lock.json 2>/dev/null; rm -f apps/web/package-lock.json
printf '\n# turborepo\n.turbo\n' >> .gitignore
```
(`.gitignore` already ignores `node_modules`, `dist`, and `docs/`.)

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "build(monorepo): add pnpm workspace + turborepo scaffolding

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: Build `packages/shared` (the zod contract) — TDD

**Files:**
- Create: `packages/shared/package.json`, `packages/shared/tsconfig.json`, `packages/shared/src/{task,auth,user,index}.ts`, `packages/shared/src/task.test.ts`

**Skills:** typescript-advanced-types

- [x] **Step 1: Create `packages/shared/package.json`**

```json
{
  "name": "@repo/shared",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" }
  },
  "files": ["dist"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "dev": "tsc -p tsconfig.json --watch",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "zod": "^4.3.6"
  },
  "devDependencies": {
    "typescript": "^6.0.2",
    "vitest": "^4.1.5"
  }
}
```

- [x] **Step 2: Create `packages/shared/tsconfig.json`** (mirrors the server's nodenext setup so emitted output matches)

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "target": "esnext",
    "lib": ["esnext"],
    "rootDir": "./src",
    "outDir": "./dist",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "rewriteRelativeImportExtensions": true,
    "moduleDetection": "force",
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["dist", "node_modules", "src/**/*.test.ts"]
}
```

- [x] **Step 3: Create `packages/shared/src/task.ts`** (schemas moved verbatim from the server's `task.dto.ts`, plus the `Task` response shape)

```ts
import { z } from 'zod';

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  isCompleted: z.boolean(),
});
export type Task = z.infer<typeof taskSchema>;

export const createTaskBodySchema = z.object({
  title: z
    .string({ error: 'Title must be a string' })
    .trim()
    .min(1, 'Title must be a non-empty string')
    .max(255, 'Title is too long (maximum 255 characters)'),
  isCompleted: z.boolean({ error: 'isCompleted must be a boolean' }).optional(),
});
export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;

export const updateTaskBodySchema = z
  .object({
    title: z
      .string({ error: 'Title must be a string' })
      .trim()
      .min(1, 'Title must be a non-empty string')
      .max(255, 'Title is too long (maximum 255 characters)')
      .optional(),
    isCompleted: z.boolean({ error: 'isCompleted must be a boolean' }).optional(),
  })
  .refine((data) => data.title !== undefined || data.isCompleted !== undefined, {
    message: 'Please provide either a title or isCompleted status to update',
  });
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
```

- [x] **Step 4: Create `packages/shared/src/auth.ts`**

```ts
import { z } from 'zod';

export const loginBodySchema = z.object({
  email: z.email({ error: 'Invalid email address' }),
  password: z.string({ error: 'Password must be a string' }).min(1, 'Password is required'),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
```

- [x] **Step 5: Create `packages/shared/src/user.ts`** (public projection — no password)

```ts
import { z } from 'zod';

export const userRoleSchema = z.enum(['admin', 'user']);
export type UserRole = z.infer<typeof userRoleSchema>;

// ponytail: contract-completeness — required by the assignment's shared-types list.
// Neither app consumes `User` yet; it's the public projection of the server's UserEntity (no password).
export const userPublicSchema = z.object({
  id: z.string(),
  email: z.email(),
  role: userRoleSchema,
});
export type User = z.infer<typeof userPublicSchema>;
```

- [x] **Step 6: Create the barrel `packages/shared/src/index.ts`**

```ts
export * from './task.ts';
export * from './auth.ts';
export * from './user.ts';
```

- [x] **Step 7: Write the failing test `packages/shared/src/task.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { createTaskBodySchema, updateTaskBodySchema, taskSchema } from './task.ts';

describe('createTaskBodySchema', () => {
  it('accepts a valid title', () => {
    expect(createTaskBodySchema.parse({ title: 'Buy milk' })).toEqual({ title: 'Buy milk' });
  });
  it('rejects an empty title', () => {
    expect(() => createTaskBodySchema.parse({ title: '' })).toThrow();
  });
});

describe('updateTaskBodySchema', () => {
  it('rejects an empty patch (neither field present)', () => {
    expect(() => updateTaskBodySchema.parse({})).toThrow();
  });
});

describe('taskSchema', () => {
  it('parses a complete task', () => {
    const t = { id: '1', title: 'x', isCompleted: false };
    expect(taskSchema.parse(t)).toEqual(t);
  });
});
```

- [x] **Step 8: Install deps (first pnpm install — generates the lockfile) and run the test to verify it passes**

```bash
pnpm install
pnpm --filter @repo/shared test
```
Expected: pnpm links the workspace and writes `pnpm-lock.yaml`; Vitest reports 4 passing tests.

- [x] **Step 9: Build the package and confirm `dist` is emitted**

```bash
pnpm --filter @repo/shared build
ls packages/shared/dist
```
Expected: `index.js index.d.ts task.js task.d.ts auth.js user.js ...`.

- [x] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(shared): add @repo/shared zod contract package

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: Wire the web app to `@repo/shared` + add the `typecheck` script

**Files:**
- Modify: `apps/web/package.json`, `apps/web/src/features/todo/types.ts`, `apps/web/src/features/todo/api/tasksApi.ts`, `apps/web/src/lib/api.ts`

**Skills:** typescript-advanced-types

- [x] **Step 1: Rename the web package, add the dep, add scripts**

In `apps/web/package.json`: set `"name": "@repo/web"`, add `"@repo/shared": "workspace:*"` and `"zod": "^4.3.6"` to `dependencies`, and update `scripts` so Turbo gets a non-watch `test` and a `typecheck`:

```jsonc
{
  "name": "@repo/web",
  // ...
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "typecheck": "tsc -b --noEmit",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

- [x] **Step 2: Re-point the web `Task` type at the shared contract**

Replace the entire body of `apps/web/src/features/todo/types.ts` with:

```ts
export type { Task } from '@repo/shared'
```

- [x] **Step 3: Use the shared `UpdateTaskBody` type in the tasks API**

In `apps/web/src/features/todo/api/tasksApi.ts`, change the `updateTask` signature to use the shared type. Replace the import line and the `changes` parameter type:

```ts
import { api } from '@/lib/api'
import type { Task, UpdateTaskBody } from '@repo/shared'

// ...

export async function updateTask(id: string, changes: UpdateTaskBody): Promise<Task> {
    const response = await api.put<Task>(`/tasks/${id}`, changes)
    return response.data
}
```
(The other functions already import `Task`; the `import type { Task } from '@/features/todo/types'` line is replaced by the `@repo/shared` import above — remove the old `types` import.)

- [x] **Step 4: Type the login response with the shared `AuthTokens`**

In `apps/web/src/lib/api.ts`, add the import and replace the inline response generic:

```ts
import axios from 'axios'
import type { AuthTokens } from '@repo/shared'

// ...inside login():
    const { data } = await api.post<AuthTokens>('/auth/login', {
        email: import.meta.env.VITE_DEV_EMAIL,
        password: import.meta.env.VITE_DEV_PASSWORD,
    })
```

- [x] **Step 5: Point the web at the `/api`-prefixed API**

The server moves its API under `/api` (Task 9), so the web's base URL must include it. Update `apps/web/.env.example` (and your local `apps/web/.env.local`) so `VITE_API_BASE_URL` ends in `/api`:

```
VITE_API_BASE_URL=http://localhost:3000/api
```
(No code change in `lib/api.ts` — it already reads `VITE_API_BASE_URL`. In prod, set it to the relative `/api` for same-origin.)

- [x] **Step 6: Relink and typecheck the web app**

```bash
pnpm install
pnpm --filter @repo/web typecheck
```
Expected: install relinks `@repo/shared`; `tsc -b --noEmit` exits 0 with no errors.

- [x] **Step 7: Run the web unit tests**

Run: `pnpm --filter @repo/web test`
Expected: existing Vitest suites (todoStore, etc.) pass — the `Task` shape is unchanged, only its source moved.

- [x] **Step 8: Commit**

```bash
git add -A
git commit -m "feat(web): consume @repo/shared contract + add typecheck script

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: Graft the server into `apps/server` (history-preserving subtree)

**Files:**
- Move: entire `server` repo → `apps/server/` (subtree)

- [x] **Step 1: Add the server repo as a remote and fetch it**

```bash
cd /Users/nadavramon/fullstack_projects/React_Intro
git remote add server-origin https://github.com/nadavramon/server.git
git fetch server-origin
```
Expected: fetch reports the server's branches (`main`).

- [x] **Step 2: Subtree-add the server under `apps/server`, preserving history**

```bash
git subtree add --prefix=apps/server server-origin main
```
Expected: a merge commit; `apps/server/` now contains `src package.json tsconfig.json Dockerfile ...`.

- [x] **Step 3: Verify both histories are present**

Run: `git log --oneline -- apps/server | tail -3 && echo '---' && git log --oneline -- apps/web | tail -3`
Expected: `apps/server` log shows the server's original commits; `apps/web` shows React-Intro's — both lineages survive.

- [x] **Step 4: Remove the server's now-redundant npm lockfile and root-clutter files**

```bash
git rm apps/server/package-lock.json
git rm -r --ignore-unmatch apps/server/.github   # its CI/deploy is relocated to the monorepo root in Tasks 8–9
git commit -m "chore(server): drop in-package lockfile and per-repo workflows

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: Wire the server to `@repo/shared`

**Files:**
- Modify: `apps/server/package.json`, `apps/server/src/modules/task/task.dto.ts`, `apps/server/src/modules/auth/auth.dto.ts`, `apps/server/src/modules/auth/auth.types.ts`

- [x] **Step 1: Rename the server package and add the workspace dep**

In `apps/server/package.json`: set `"name": "@repo/server"`, and add `"@repo/shared": "workspace:*"` to `dependencies`. Add a `lint` placeholder so Turbo's `lint` task has a target (the server has no ESLint today):

```jsonc
{
  "name": "@repo/server",
  // ...
  "scripts": {
    // ...existing scripts unchanged...
    "lint": "echo \"(server: no eslint configured)\" && exit 0"
  }
}
```

- [x] **Step 2: Re-export the task DTO schemas from shared (keep server-only query schema local)**

Replace the `CreateTaskBodySchema` and `UpdateTaskBodySchema` definitions in `apps/server/src/modules/task/task.dto.ts` with aliased re-exports from `@repo/shared`, keeping `GetTasksQuerySchema` (HTTP querystring coercion — server-only) in place:

```ts
import { z } from 'zod';
export {
  createTaskBodySchema as CreateTaskBodySchema,
  updateTaskBodySchema as UpdateTaskBodySchema,
} from '@repo/shared';
export type { CreateTaskBody as CreateTaskBodyDto, UpdateTaskBody as UpdateTaskBodyDto } from '@repo/shared';

export const GetTasksQuerySchema = z.object({
  isCompleted: z
    .enum(['true', 'false'], { error: 'isCompleted must be "true" or "false"' })
    .transform((v) => v === 'true')
    .optional(),
});
export type GetTasksQueryDto = z.infer<typeof GetTasksQuerySchema>;
```
(`task.controller.ts` and `task.service.ts` import these names unchanged — the aliases keep them working.)

- [x] **Step 3: Re-export the login schema from shared**

In `apps/server/src/modules/auth/auth.dto.ts`, replace the local `LoginBodySchema` definition with a re-export (keep `RegisterBodySchema` and `RefreshBodySchema` local):

```ts
export { loginBodySchema as LoginBodySchema } from '@repo/shared';
export type { LoginBody as LoginBodyDto } from '@repo/shared';
```
Leave the existing `import { z } from 'zod'` and the `RegisterBodySchema` / `RefreshBodySchema` blocks untouched.

- [x] **Step 4: Source the `AuthTokens` type from shared**

Replace the `AuthTokens` interface in `apps/server/src/modules/auth/auth.types.ts` with a re-export, keeping the server-internal `JwtPayload`:

```ts
import { UserRole } from '../user/user.entity.ts';

export interface JwtPayload {
  userId: string;
  email: string;
  role: UserRole;
}

export type { AuthTokens } from '@repo/shared';
```

- [x] **Step 5: Relink, typecheck, and test the server**

```bash
pnpm install
pnpm --filter @repo/shared build   # server's nodenext build needs shared's .d.ts present
pnpm --filter @repo/server typecheck
pnpm --filter @repo/server test
```
Expected: typecheck exits 0; the server's Vitest suites (`task.service.test`, `task.cache.test`) pass.

- [x] **Step 6: Commit**

```bash
git add -A
git commit -m "feat(server): consume @repo/shared contract via re-exports

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Whole-repo install + Turbo verification (clean lockfile)

**Files:** none (verification + lockfile)

- [x] **Step 1: Regenerate the lockfile clean** (mirrors the npm-lockfile-drift lesson: a clean regen avoids stale/platform-specific drift that passes locally but fails Linux CI)

```bash
rm -rf node_modules apps/*/node_modules packages/*/node_modules pnpm-lock.yaml
pnpm install
```
Expected: a fresh `pnpm-lock.yaml` with all three workspace packages linked.

- [x] **Step 2: Run the full Turbo gauntlet across the repo**

```bash
pnpm turbo run build lint typecheck test
```
Expected: Turbo builds `@repo/shared` first, then web + server; `lint`, `typecheck`, `test` all green. (First run is uncached; a second run should report `FULL TURBO` cache hits.)

- [x] **Step 3: Confirm caching works (the Turbo-over-workspaces payoff)**

Run: `pnpm turbo run build`
Expected: `>>> FULL TURBO` — all tasks replayed from cache, near-zero time.

- [x] **Step 4: Commit the lockfile**

```bash
git add -A
git commit -m "build(monorepo): regenerate clean pnpm lockfile; full turbo verify green

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: Unified CI workflow

**Files:**
- Create/replace: `.github/workflows/ci.yml`
- Delete: any stale duplicate workflow at root left over from the web's broken `.github` copy (keep `codeql.yml`)

- [x] **Step 1: Replace `.github/workflows/ci.yml` with a pnpm + Turbo workflow**

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

permissions:
  contents: read

jobs:
  verify:
    name: Verify
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v6
        with:
          node-version-file: '.nvmrc'
          cache: 'pnpm'
      - run: pnpm install --frozen-lockfile
      - run: pnpm format:check
      - run: pnpm turbo run lint typecheck test build
```
(`pnpm/action-setup@v4` reads the pinned version from the root `packageManager` field — no `version:` needed.)

- [x] **Step 2: Remove the stale server-flavored deploy workflow at root (it'll be re-added correctly in Task 9)**

```bash
git rm -f .github/workflows/deploy.yml .github/workflows/release.yml 2>/dev/null || true
```
(Keep `.github/workflows/codeql.yml` — it scans the whole repo and still works.)

- [x] **Step 3: Validate the workflow locally (syntax)**

Run: `python3 -c "import yaml,sys; yaml.safe_load(open('.github/workflows/ci.yml')); print('ci.yml OK')"`
Expected: `ci.yml OK`

- [x] **Step 4: Commit**

```bash
git add -A
git commit -m "ci: unified pnpm + turbo workflow for the monorepo

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Serve web from Express (API under `/api`) + single auto-deploy

**Files:**
- Modify: `apps/server/src/app.ts`, `apps/server/src/shared/utils/swagger.ts`, `apps/server/Dockerfile`
- Create: `.github/workflows/deploy.yml`

> **Manual gate (confirm with the user during implement — highest-risk assumption):** the current deploy only runs `systemctl restart server` over SSM, so the EC2 box builds the code itself. After the move the box must build the **whole workspace** (shared + server + web). The SSM command below assumes repo path `/opt/app` and that `git pull` + `pnpm` work there — **confirm the box's actual repo path, that pnpm/corepack is available, and the systemd `WorkingDirectory` before this goes live.** Also confirm where the web `dist` is served from relative to the running server (Step 1 resolves it relative to the compiled file, which is robust regardless of `cwd`).

- [x] **Step 1: Mount the API under `/api` and serve the web build from Express**

Edit `apps/server/src/app.ts`. Move the API mounts under `/api`, keep `/health` at root (infra healthcheck), and add static serving + an SPA catch-all **after** the API routes but **before** the error handler. Guard the static serving with `existsSync` so dev (no web build) is unaffected:

```ts
import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import taskRoutes from './modules/task/task.routes.ts';
import authRoutes from './modules/auth/auth.routes.ts';
import postRoutes from './modules/post/post.routes.ts';
import { httpLogger } from './shared/middlewares/httpLogger.ts';
import { errorHandler } from './shared/middlewares/errorHandler.ts';
import { swaggerUi, swaggerSpec } from './shared/utils/swagger.ts';
import { limiter } from './shared/middlewares/rateLimiter.ts';
import cors from 'cors';

export const app = express();

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(httpLogger);
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
app.use(express.json());

app.use(limiter);
app.use('/api/auth', authRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve the web SPA build when present (prod). apps/server/dist/app.js → apps/web/dist
const webDist = path.resolve(import.meta.dirname, '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  // Express 5 uses path-to-regexp v8, which REJECTS a bare '*' path (throws
  // "Missing parameter name" at startup) — use a RegExp instead. Serve the SPA
  // shell for any GET that isn't an /api route, so client-side deep links
  // (/tasks, /counter, …) resolve to index.html. Unknown /api/* still 404s.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use(errorHandler);
```
(`import.meta.dirname` is available on Node 24. `errorHandler` stays LAST so API errors still format correctly; the static/SPA block sits just above it. `/health` is matched by the top handler before ever reaching the fallback. Note: the global `limiter` now also covers static/SPA requests — fine at these volumes for a learning app; move it under `/api` later if asset requests ever trip the limit.)

- [x] **Step 2: Point swagger at the `/api` base**

In `apps/server/src/shared/utils/swagger.ts`, update the OpenAPI server URL so it reflects the new prefix. Find the `servers` / `url` entry and set it to include `/api` (e.g. `http://localhost:3000/api`). If the file has no explicit `servers` block, add one:

```ts
servers: [{ url: 'http://localhost:3000/api' }],
```

- [x] **Step 3: Verify the prefix didn't break server tests**

Run: `pnpm --filter @repo/server test`
Expected: green. If any test hits HTTP paths like `/tasks` directly (supertest), update them to `/api/tasks`. (The known suites — `task.service.test`, `task.cache.test` — are service-level and unaffected.)

- [x] **Step 4: Update the server `Dockerfile` to build the whole workspace and ship the web build**

Replace `apps/server/Dockerfile` (built from the repo root: `docker build -f apps/server/Dockerfile .`). It builds shared + server + web, and copies the web build so Express can serve it:

```dockerfile
FROM node:24-alpine AS builder
RUN corepack enable
WORKDIR /app
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm turbo run build

FROM node:24-alpine
RUN corepack enable
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile --prod
COPY --from=builder /app/packages/shared/dist ./packages/shared/dist
COPY --from=builder /app/apps/server/dist ./apps/server/dist
COPY --from=builder /app/apps/web/dist ./apps/web/dist
ENV NODE_ENV=dev
ENV PORT=3000
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||3000)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "apps/server/dist/index.js"]
```

- [x] **Step 5: Create the single `.github/workflows/deploy.yml`** (auto on main; box builds the whole workspace, then restart — one box serves API + web)

```yaml
name: Deploy

on:
  push:
    branches: [main]

concurrency:
  group: deploy-${{ github.ref }}
  cancel-in-progress: false

permissions:
  id-token: write
  contents: read

jobs:
  deploy:
    name: Build workspace + restart on EC2
    runs-on: ubuntu-latest
    steps:
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v4
        with:
          role-to-assume: arn:aws:iam::825765398865:role/github-deploy
          aws-region: eu-central-1
      - name: Build + restart via SSM
        id: send
        run: |
          CMD_ID=$(aws ssm send-command \
            --instance-ids i-050b3d01b5fbd58fa \
            --document-name AWS-RunShellScript \
            --comment "deploy ${{ github.sha }}" \
            --parameters 'commands=["cd /opt/app && git pull --ff-only && corepack enable && pnpm install --frozen-lockfile && pnpm turbo run build && systemctl restart server"]' \
            --query 'Command.CommandId' --output text)
          echo "command_id=$CMD_ID" >> "$GITHUB_OUTPUT"
      - name: Wait for command to finish
        run: |
          aws ssm wait command-executed --command-id "${{ steps.send.outputs.command_id }}" --instance-id i-050b3d01b5fbd58fa
          STATUS=$(aws ssm get-command-invocation --command-id "${{ steps.send.outputs.command_id }}" --instance-id i-050b3d01b5fbd58fa --query 'Status' --output text)
          echo "Final status: $STATUS"
          if [ "$STATUS" != "Success" ]; then
            aws ssm get-command-invocation --command-id "${{ steps.send.outputs.command_id }}" --instance-id i-050b3d01b5fbd58fa
            exit 1
          fi
```

- [x] **Step 6: Validate the workflow YAML**

Run: `python3 -c "import yaml; yaml.safe_load(open('.github/workflows/deploy.yml')); print('deploy.yml OK')"`
Expected: `deploy.yml OK`

- [x] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(server): serve web build under /; API under /api; single auto-deploy

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 10: Dev smoke test, docs, and PR

**Files:**
- Modify: `docs/superpowers/INDEX.md`, `docs/superpowers/JOURNAL.md` (local-only; `docs/` is gitignored)

- [x] **Step 1: Smoke-test the dev fan-out**

```bash
pnpm turbo run dev
```
Expected: Turbo builds `@repo/shared` first, then starts the web (Vite, port 5173) and server (tsx) in parallel. With the web's `VITE_API_BASE_URL` set to `http://localhost:3000/api`, open `http://localhost:5173/tasks` (server + Mongo must be running per its `.env`); the todo list loads (requests hit `/api/tasks`). Stop with Ctrl-C.

- [x] **Step 2: Update the SDD tracking docs** (on disk only — not committed; `docs/` is gitignored)

Set the monorepo row in `docs/superpowers/INDEX.md` to `Plan` linked + Status `Done`, and append a `## <timestamp> — implement: polyrepo-to-monorepo` entry to `docs/superpowers/JOURNAL.md` summarizing what shipped and the carried risk (the EC2 box's repo path + `pnpm turbo run build` deploy step needs confirming on the real box).

- [x] **Step 3: Push the branch and open a PR**

```bash
git push -u origin feat/monorepo-turborepo
gh pr create --title "Monorepo: pnpm + Turborepo with shared zod contract" --body-file <(cat <<'EOF'
Migrates the polyrepo (React-Intro + server) into a single pnpm + Turborepo monorepo.

- **apps/web** — the React app (relocated, package `@repo/web`).
- **apps/server** — the Express API, grafted via `git subtree` (history preserved), package `@repo/server`. It also serves the web's static build, with the API mounted under `/api`.
- **packages/shared** — `@repo/shared`: zod schemas + inferred types as the single source of truth (Task, User, AuthTokens, create/update/login bodies). Server re-exports them under its existing DTO names; web imports the types.
- **Turbo** orchestrates `dev`/`build`/`lint`/`typecheck`/`test` (`shared` built first) with caching.
- **CI** unified to `pnpm turbo run lint typecheck test build`; **deploy** automatic on main — one EC2 box builds the whole workspace and serves both the API (`/api`) and the web SPA.
- Added the missing `typecheck` script to the web app.

Carried risk to confirm before/after merge: the EC2 box's repo path + that `git pull` + `pnpm turbo run build` + restart works on the box (the SSM command assumes `/opt/app`).
EOF
)
```
(Nadav merges PRs himself. PR body intentionally omits a Test-plan section and any generated-by trailer, per repo convention.)

---

## Self-review notes

- **Spec coverage:** monorepo structure (T1, T5) ✓; pnpm workspaces (T2) ✓; Turborepo (T2, T7) ✓; extract shared types + import both sides (T3, T4, T6) ✓; turbo dev/build scripts (T2) ✓; CI (T8) + auto deploy both apps (T9 — one box serves API + web) ✓; web lint already exists + add typecheck (T4) ✓. All four conceptual questions are answered in the spec and embodied here (built shared package = how each app points at it; turbo.json = what Turbo adds; subtree = repo strategy).
- **Deviations from spec:** (1) `@repo/shared` is a built package, not source-consumed — forced by the server's `nodenext` + `declaration` build (Task 3). (2) Web is **not** hosted on S3+CloudFront (spec §6) — per user decision it's served by the Express server from one EC2 box, which required mounting the API under `/api` to avoid the `/tasks` page-vs-endpoint collision (Task 9). Simpler, one deploy target.
- **Type consistency:** shared exports `createTaskBodySchema`/`CreateTaskBody`, `updateTaskBodySchema`/`UpdateTaskBody`, `taskSchema`/`Task`, `loginBodySchema`/`LoginBody`, `authTokensSchema`/`AuthTokens`, `userPublicSchema`/`User` — referenced identically in T4/T6.
- **Carried risk (verify during implement):** EC2 box build path — T9 manual gate (repo path `/opt/app`, pnpm/corepack present, `pnpm turbo run build` + restart). Node aligned to 24 (T2).
