# TanStack Router Migration — Implementation Plan

> **For agentic workers:** implement task-by-task. This is a **cutover** migration — the app won't run mid-sequence (two routers can't coexist), so the end-to-end verification (Task 8) is the gate, not per-task `npm run dev`. Commit per task anyway for a clean history.

**Goal:** Replace react-router-dom v7 with file-based TanStack Router, preserving URLs (`/counters`, `/tic-tac-toe`, `/tasks`) and the `/` → `/counters` redirect.

**Architecture:** `@tanstack/router-plugin` (Vite) generates `src/routes/routeTree.gen.ts` from `src/routes/`. `__root.tsx` owns the shell (Layout + Toaster + todo `init()` + notFound); `index.tsx` redirects; three thin route files render the features. `main.tsx` provides the router; `App.tsx` + `AppRoutes.tsx` are deleted.

**Tech Stack:** `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/react-router-devtools`. React 19 + Vite.

**Spec:** `docs/superpowers/specs/2026-06-24-tanstack-router-design.md`

---

### Task 1: Add deps + configure the Vite plugin

**Files:**
- Modify: `vite.config.ts`, `package.json`

- [x] **Step 1:** `npm install @tanstack/react-router @tanstack/router-plugin @tanstack/react-router-devtools` then `npm uninstall react-router-dom`.
- [x] **Step 2:** In `vite.config.ts`, import `import { tanstackRouter } from '@tanstack/router-plugin/vite'` and add it as the **first** plugin (before `react()`): `tanstackRouter({ target: 'react', autoCodeSplitting: false })`.
- [x] **Step 3:** Inspect `git diff package-lock.json` for surprise deletions of cross-platform optional deps (known npm drift foot-gun) — restore if any vanished. *(drift = @emnapi relocation only, no drops)*
- [ ] **Step 4:** Commit. *(deferred — cutover; commit when app is green)*

---

### Task 2: Create the file-based route tree

**Files:**
- Create: `src/routes/__root.tsx`, `src/routes/index.tsx`, `src/routes/counters.tsx`, `src/routes/tic-tac-toe.tsx`, `src/routes/tasks.tsx`
- Generated (by the plugin on first dev/build): `src/routes/routeTree.gen.ts`

- [x] **Step 1: `__root.tsx`** — owns the shell + global wiring (replaces `App.tsx`'s job):

```tsx
import { useEffect } from 'react'
import { createRootRoute, Outlet } from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import Layout from '@/layout/Layout/Layout'
import NotFoundPage from '@/pages/NotFoundPage'
import { Toaster } from '@/components/ui/sonner'
import { useTodoStore } from '@/features/todo'

export const Route = createRootRoute({
    component: RootComponent,
    notFoundComponent: NotFoundPage,
})

function RootComponent() {
    useEffect(() => {
        useTodoStore.getState().init()
    }, [])
    return (
        <>
            <Layout />
            <Toaster richColors position="top-right" />
            {import.meta.env.DEV && <TanStackRouterDevtools />}
        </>
    )
}
```

Note: `Layout` renders `<Outlet/>`; `__root` imports `Outlet` only if it renders children directly — here Layout owns the Outlet, so `__root` does not need to (remove the unused import if so).

- [x] **Step 2: `index.tsx`** — redirect `/` → `/counters`:

```tsx
import { createFileRoute, redirect } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
    beforeLoad: () => {
        throw redirect({ to: '/counters' })
    },
})
```

- [x] **Step 3: feature routes** — three thin files (filename = URL):

```tsx
// src/routes/counters.tsx
import { createFileRoute } from '@tanstack/react-router'
import CounterApp from '@/features/counter'
export const Route = createFileRoute('/counters')({ component: CounterApp })
```
Repeat for `tic-tac-toe.tsx` (`'/tic-tac-toe'` → `TicTacToe` from `@/features/tic-tac-toe`) and `tasks.tsx` (`'/tasks'` → `TodoPage` from `@/features/todo`).

- [ ] **Step 4: Commit.** (`routeTree.gen.ts` gets generated in Task 3 when the dev server / build first runs the plugin.)

---

### Task 3: Provide the router; delete App/AppRoutes

**Files:**
- Modify: `src/main.tsx`
- Delete: `src/App.tsx`, `src/AppRoutes.tsx`

- [x] **Step 1: `main.tsx`:**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { createRouter, RouterProvider } from '@tanstack/react-router'
import './index.css'
import { routeTree } from './routes/routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
    interface Register {
        router: typeof router
    }
}

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <RouterProvider router={router} />
    </StrictMode>,
)
```

- [x] **Step 2:** `git rm src/App.tsx src/AppRoutes.tsx`. Commit. *(deletion staged; commit deferred)*

---

### Task 4: Migrate Layout to TanStack Outlet

**Files:**
- Modify: `src/layout/Layout/Layout.tsx`

- [x] **Step 1:** Change `import { Outlet } from 'react-router-dom'` → `import { Outlet } from '@tanstack/react-router'`. Everything else in Layout is unchanged (it already renders `<Outlet />` inside the shell).
- [x] **Step 2:** Commit. *(deferred — cutover)*

---

### Task 5: Migrate the Link / NavLink consumers

**Files:**
- Modify: `src/layout/Sidebar/Sidebar.tsx`, `src/layout/Header/Header.tsx`, `src/pages/NotFoundPage.tsx`
**Skills:** typescript-advanced-types

- [x] **Step 1: `Header.tsx` + `NotFoundPage.tsx`** — swap `import { Link } from 'react-router-dom'` → `import { Link } from '@tanstack/react-router'`. The `to={ROUTES.counters}` props are now type-checked against the generated route paths; `ROUTES` (`as const`) literals satisfy them, so `routes.ts` stays.
- [x] **Step 2: `Sidebar.tsx`** — swap `NavLink` (react-router) for TanStack `Link`. TanStack `Link` does not take a render-prop `className`; split the current `cn(...)` into base + active + inactive and use `activeProps` / `inactiveProps`:

```tsx
import { Link } from '@tanstack/react-router'
// ...
<Link
    key={item.to}
    to={item.to}
    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors"
    activeProps={{ className: 'bg-sidebar-accent text-foreground' }}
    inactiveProps={{
        className:
            'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
    }}
>
    <span className="flex-1">{item.label}</span>
    {item.to === ROUTES.todo && activeCount > 0 && (
        /* unchanged badge */
    )}
</Link>
```
Keep `NAV_ITEMS`, `ROUTES`, the `activeCount` selector, and the badge exactly as-is.
- [x] **Step 3:** Commit. *(deferred — cutover)*

---

### Task 6: Track the generated tree + ignore it from tooling; fix docs

**Files:**
- Modify: `.prettierignore`, `eslint.config.js`, `CLAUDE.md`
- Add: `src/routes/routeTree.gen.ts` (commit the generated file)

- [x] **Step 1:** Confirm `src/routes/routeTree.gen.ts` exists (run `npx vite build` once if not) and `git add` it — committing it avoids `tsc -b` failing before the plugin runs (CI order is `tsc -b && vite build`).
- [x] **Step 2:** Add `src/routes/routeTree.gen.ts` to `.prettierignore` and to the `ignores` in `eslint.config.js` (generated file, don't lint/format it).
- [x] **Step 3:** Update `CLAUDE.md`: Stack "Routing" line → TanStack Router (file-based, `src/routes/`); Architecture line `src/routes.ts + src/AppRoutes.tsx — route table` → describe `src/routes/` + generated `routeTree.gen.ts`.
- [ ] **Step 4:** Commit.

---

### Task 7: Tests

**Files:**
- (likely none)

- [x] **Step 1:** Run `npm run test:run`. Existing tests (`CounterApp.test.tsx`, `ticTacToeLogic.test.ts`, `todoStore.test.ts`) don't render routing, so they should pass untouched. If `CounterApp.test.tsx` happens to pull in a `Link`, wrap the render in a `RouterProvider` with `createMemoryHistory`; otherwise no change. Do not add new tests (YAGNI — e2e covers routing).

---

### Task 8: Verify end-to-end

- [x] **Step 1:** `npm run dev` — `/` redirects to `/counters`; all three routes render; sidebar highlights the active route (active styling via `activeProps`); the todo badge still shows; an unknown path renders NotFound; router devtools appears in dev only. *(redirect + nav + badge verified via e2e, which boots the dev server; explicit 404/devtools visual check optional)*
- [x] **Step 2:** `npm run build` (`tsc -b && vite build`) — clean. Confirms the committed `routeTree.gen.ts` satisfies `tsc -b`.
- [x] **Step 3:** `npm run test:run` — green.
- [x] **Step 4:** `npm run test:e2e` — green **unmodified** (URLs + redirect unchanged = behavior-parity proof). 4/4 passed.

---

## Verification

The migration is correct when: URLs and the `/`→`/counters` redirect are unchanged, all routes render inside the persistent shell, active nav styling works, 404 shows NotFound, `npm run build` is clean (gen file committed), and `npm run test:e2e` passes without edits.

## Notes

- `src/routes.ts` (`ROUTES`) is kept — `NAV_ITEMS`/Header/NotFound still use it, and its `as const` literals satisfy TanStack's typed `to`.
- Task 5 carries `**Skills:** typescript-advanced-types` — this is the **dogfood target** for the subagent-task-equipment feature (its task 7). Running `/implement` on Task 5 should dispatch a subagent equipped with that skill.
- All files here are tracked (`src/`, root configs) — fully committable, unlike the `docs/` artifacts.
