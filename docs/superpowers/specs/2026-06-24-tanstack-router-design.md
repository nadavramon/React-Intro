# TanStack Router Migration — Design

**Date:** 2026-06-24
**Status:** Spec'd

## Problem

Routing currently uses **react-router-dom v7**: `BrowserRouter` in `App.tsx`, an explicit `<Routes>` tree in `AppRoutes.tsx`, a `ROUTES` string map in `routes.ts`, and `Link`/`NavLink` consumers in the layout. It works, but gives only string-level safety — no type-checked paths, params, or search. This is a learning sandbox; migrating to **TanStack Router (file-based)** is the exercise, and its full type-safety + file-based DX is the actual reason to switch.

## Goals

- Replace react-router-dom with TanStack Router, **file-based** route definitions.
- **Behavior parity:** identical URLs (`/counters`, `/tic-tac-toe`, `/tasks`) and the `/` → `/counters` index redirect.
- **Full replacement:** remove `react-router-dom` entirely — two routers sharing history is broken.

## Non-goals

- No URL/redirect changes. No new routes, params, or search params.
- `autoCodeSplitting` is out of scope (optional learning extra, noted not adopted).
- No changes to feature internals (counter, tic-tac-toe, todo) beyond what routing wiring requires.

## Approach: file-based routing

The `@tanstack/router-plugin` Vite plugin watches `src/routes/` and generates `routeTree.gen.ts` (the type-safe route tree). Route files map filename → URL.

### Route directory (`src/routes/`)

- **`__root.tsx`** — root route. Owns what `App.tsx` + `Layout.tsx` do today: renders the app shell (Header + Sidebar) with `<Outlet/>`, the `<Toaster/>`, fires the global `useTodoStore.getState().init()` on mount, and declares `notFoundComponent` (replacing the `path="*"` route). Renders dev-only `<TanStackRouterDevtools/>`.
- **`index.tsx`** — `/` route; `redirect({ to: '/counters' })` (replaces `<Navigate replace>`).
- **`counters.tsx`** — renders `CounterApp` (→ `/counters`).
- **`tic-tac-toe.tsx`** — renders `TicTacToe` (→ `/tic-tac-toe`).
- **`tasks.tsx`** — renders `TodoPage` (→ `/tasks`).

### Router instance & provider

`src/main.tsx`: `createRouter({ routeTree })`, register types via
`declare module '@tanstack/react-router' { interface Register { router: typeof router } }`,
render `<RouterProvider router={router} />`. `App.tsx` dissolves — its logic moves to `__root.tsx` + `main.tsx`.

## File changes

| File | Change |
| --- | --- |
| `vite.config.ts` | add `tanstackRouter({ target: 'react' })` plugin, **before** the React plugin |
| `src/routes/__root.tsx` + `index/counters/tic-tac-toe/tasks.tsx` | **new** route files |
| `src/routes/routeTree.gen.ts` | **new, generated** — committed (see gotcha) |
| `src/main.tsx` | RouterProvider + router instance + type registration |
| `src/App.tsx` | **removed** (logic → `__root`) |
| `src/AppRoutes.tsx` | **removed** (tree is now the directory) |
| `src/layout/Layout/Layout.tsx` | folds into `__root` (or stays as a component imported by root) |
| `src/layout/Sidebar/Sidebar.tsx`, `Header/Header.tsx`, `src/pages/NotFoundPage.tsx` | `Link`/`NavLink` (react-router) → TanStack `<Link to=…>` (type-safe `to`); `NavLink` active styling → Link `activeProps` / `data-status="active"` |
| `src/routes.ts` | `ROUTES` map mostly redundant (typed `to` replaces string safety) — keep only the nav-item list `Sidebar` maps over, or inline it |
| `package.json` | **add** `@tanstack/react-router`, `@tanstack/router-plugin`, `@tanstack/react-router-devtools`; **remove** `react-router-dom` |

## Data flow

Unchanged in substance. Navigation still pushes history; the root route renders the persistent shell; feature components render in the `<Outlet/>`. The todo global `init()` still fires once at app mount, now from `__root`'s component rather than `App.tsx`.

## Error handling

- Unknown paths → root route's `notFoundComponent` (renders the existing `NotFoundPage` content).
- No new error surfaces; feature-level error handling (todo store status/error) is untouched.

## Testing

- **E2E (Playwright) is the parity safety net.** URLs and the index redirect are unchanged, so `e2e/*.spec.ts` should pass without edits — this is the proof the swap preserved behavior.
- **Component tests** that render a TanStack `<Link>` need router context. Add a small test helper that wraps the subject in `<RouterProvider>` with `createMemoryHistory`. Pure-logic tests (`todoStore.test.ts`, TaskList rendering) are unaffected.

## Gotcha: `routeTree.gen.ts` vs CI order

`npm run build` is `tsc -b && vite build`. The router plugin generates `routeTree.gen.ts` during **vite**, not **tsc** — so on a clean checkout `tsc -b` runs first and fails on the missing file. **Resolution: commit `routeTree.gen.ts`** (generated but tracked) and add it to `.prettierignore` + the eslint ignore list so the generated file isn't linted/formatted. The CI `tsc -b` then always finds it.

## Verification

1. `npm run dev` — all three routes load; sidebar nav highlights the active route; `/` redirects to `/counters`; an unknown path shows NotFound.
2. `npm run build` (`tsc -b && vite build`) clean — confirms the gen-file/CI-order fix.
3. `npm run test:run` green (with the new router test helper).
4. `npm run test:e2e` green unmodified — behavior parity confirmed.
