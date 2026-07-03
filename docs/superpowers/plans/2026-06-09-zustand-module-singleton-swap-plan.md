# Plan: Swap Zustand factory + React Context for module singleton

> **Plan-location note:** Per the user's `feedback_plan_location` memory, plans for React_Intro live in `docs/superpowers/plans/`. Plan mode forced this file into `~/.claude/plans/`. After ExitPlanMode, move this file to `docs/superpowers/plans/2026-06-08-zustand-module-singleton-swap.md` before starting implementation.

## Context

PRs #11 and #12 shipped global Todo state via the **Zustand factory + React Context Provider** pattern (`createTodoStore()` factory, `<TodoStoreProvider>` wrapper, `useTodoStore` bridge with `useContext + useStore`). It was the right shape for the original assignment — which specified "wrap the app in a Provider" — and it gave us per-test store isolation through the Provider's mount lifecycle.

After shipping, the user observed (correctly) that the assignment language was the *only* reason we picked factory+Context over Zustand's simpler "hello world" module singleton (`export const useTodoStore = create(...)`). With the assignment graded, the Provider is now pure ceremony — it costs ~50 LOC, three files, and the `useContext` indirection in every consumer subscription. No SSR, no per-Provider-mount test isolation gain, no need for runtime store-instance swapping.

This PR (#13, on a fresh branch off `main` *after* PR #12 lands) collapses the architecture to the canonical Zustand module-singleton shape. **Behavior identical** for end users. Bundle smaller. Mental model thinner.

## Trade-offs accepted (user-confirmed)

- **Lose:** the literal "wrap in Provider" pattern from the assignment text → fine, already shipped
- **Lose:** test isolation via fresh-store-per-Provider-mount → replaced with `useTodoStore.setState(INITIAL_STATE)` in `beforeEach`
- **Lose:** the "throws if used outside Provider" runtime guard → no Provider to require, the guard test goes away
- **Lose:** SSR safety of factory pattern → N/A, Vite SPA, no SSR

- **Gain:** 3 files deleted (`todoStoreContext.ts`, `TodoStoreProvider.tsx`, `useTodoStore.ts` consolidated into `todoStore.ts`)
- **Gain:** 1 unit test file deleted (`useTodoStore.test.tsx` — the Provider-guard test becomes meaningless)
- **Gain:** `App.tsx` drops the Provider wrap (replaced by a 3-line `useEffect`)
- **Gain:** no `useContext` indirection in any consumer
- **Gain:** typical Zustand pattern — easier for newcomers to recognize

## Workflow setup (before any code change)

1. Confirm PR #12 is merged to `origin/main`
2. `git fetch origin && git checkout main && git pull`
3. `git checkout -b refactor/zustand-module-singleton`

## File changes

### Rewrite — `src/features/todo/store/todoStore.ts`

Replace `createStore` from `zustand/vanilla` + factory function with `create` from `zustand` directly. All per-action hooks (`useAddTask`, `useToggleTask`, `useDeleteTask`, `useDeleteCompleted`) move into this same file. State shape, action implementations, `TodoStatus` const all stay byte-identical.

Target shape:

```ts
import { create } from 'zustand'
import type { Task } from '@/features/todo/types'
import { createTask, deleteTask, fetchTasks, updateTask } from '@/features/todo/api/tasksApi'

export const TodoStatus = { Idle: 'idle', Loading: 'loading', Ready: 'ready', Error: 'error' } as const
export type TodoStatus = (typeof TodoStatus)[keyof typeof TodoStatus]

export type TodoState = { /* same as today: tasks, status, errorMessage, init, addTask, toggleTask, deleteTask, deleteCompleted */ }

export const useTodoStore = create<TodoState>((set, get) => ({
    // ...exact same body as today's createTodoStore() inner factory
}))

export const useAddTask = () => useTodoStore((s) => s.addTask)
export const useToggleTask = () => useTodoStore((s) => s.toggleTask)
export const useDeleteTask = () => useTodoStore((s) => s.deleteTask)
export const useDeleteCompleted = () => useTodoStore((s) => s.deleteCompleted)
```

Drop: `createTodoStore` export, `TodoStore` type export (no longer needed by anything).

### Delete — three files

- `src/features/todo/store/todoStoreContext.ts` — the Context object
- `src/features/todo/store/TodoStoreProvider.tsx` — the Provider component
- `src/features/todo/store/useTodoStore.ts` — the bridge hook (its contents fold into `todoStore.ts`)

### Delete — one test file

- `src/features/todo/store/useTodoStore.test.tsx` — the "throws outside Provider" guard. The guard no longer exists.

### Rewrite — `src/features/todo/store/todoStore.test.ts`

Replace every `const store = createTodoStore()` with reads/writes through the module-singleton `useTodoStore`:

```ts
import { useTodoStore, TodoStatus } from './todoStore'
// ...mocks unchanged

const INITIAL_STATE = {
    tasks: [],
    status: TodoStatus.Idle,
    errorMessage: null,
}

beforeEach(() => {
    useTodoStore.setState(INITIAL_STATE)
    vi.clearAllMocks()
})

// then in tests:
expect(useTodoStore.getState().status).toBe(TodoStatus.Idle)
await useTodoStore.getState().init()
// etc.
```

`setState(INITIAL_STATE)` is a shallow merge → actions (already defined in `create()`) are preserved. Tests stay logically identical; only the access path changes. All 11 tests continue to assert the same behaviors.

### Modify — `src/App.tsx`

Drop the Provider wrap. Add an inline `useEffect` to fire `init()` once on mount.

```tsx
import { useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './AppRoutes'
import { Toaster } from '@/components/ui/sonner'
import { useTodoStore } from '@/features/todo'

export default function App() {
    useEffect(() => {
        useTodoStore.getState().init()
    }, [])

    return (
        <BrowserRouter>
            <AppRoutes />
            <Toaster richColors position="top-right" />
        </BrowserRouter>
    )
}
```

Why this still satisfies the requirements:
- **Once on mount** — empty deps array, fires exactly once after first render
- **StrictMode-safe** — `init()`'s `if (get().status !== 'idle') return` guard handles the dev-mode double-invoke
- **Reaches all routes** — the call is at the app root; `useTodoStore` is the same singleton everywhere it's imported

### Modify — `src/features/todo/index.ts`

```ts
export { default } from './TodoPage'
export { useTodoStore } from './store/todoStore'
```

Drops the `TodoStoreProvider` re-export (no longer exists) and points `useTodoStore` at the new home.

### Modify — three consumer files (import paths only)

- `src/features/todo/TodoPage.tsx` — change `from './store/useTodoStore'` and `from './store/todoStore'` imports to come from a single `'./store/todoStore'` source
- `src/features/todo/components/AddTaskForm/AddTaskForm.tsx` — `useAddTask` import path: `'@/features/todo/store/useTodoStore'` → `'@/features/todo/store/todoStore'`
- `src/features/todo/components/TaskList/TaskList.tsx` — `useToggleTask` import path: same change

### No changes — `src/layout/Sidebar/Sidebar.tsx`

Already imports `useTodoStore` from `@/features/todo` (the feature's public surface). The surface still exports it; no edit needed.

### No changes — E2E tests + mocks

`e2e/todo-global-state.spec.ts`, `e2e/counter.spec.ts`, `e2e/helpers/mockTasksApi.ts`, `playwright.config.ts` are all behavior-only consumers. The store works identically from a black-box view. Zero changes.

## Test strategy

Two layers:

1. **Unit tests** — `npm run test:run`. Rewritten `todoStore.test.ts` runs against the module singleton with `setState`-based reset. Expected: 20/20 green (one less than current 21 because `useTodoStore.test.tsx` is deleted).

2. **E2E tests** — `npm run test:e2e`. Should pass unchanged. Both `counter.spec.ts` and `todo-global-state.spec.ts` exercise the app via the browser and use mocked endpoints (PR #11 work). No structural dependency on the Provider.

## Verification (full sweep before pushing)

```bash
# 1. Static checks
npm run lint                  # expect: clean
npx tsc -b                    # expect: exit 0
npm run format:check          # expect: clean (or run npm run format)

# 2. Unit tests
npm run test:run              # expect: 20 passed (4 files: counter, ticTacToeLogic, todoStore × rewritten, no useTodoStore.test.tsx)

# 3. E2E
npm run test:e2e              # expect: 4 passed (~3s)

# 4. Manual smoke
npm run dev
# Visit http://localhost:5173/tasks:
#   - tasks load (real backend if running, mock-401-handled otherwise via auth interceptor)
#   - add a task → toast, badge increments
#   - toggle a task → checkbox flips, no toast (per PR #12), badge changes
#   - navigate /counters then back to /tasks → NO spinner, data instant
#   - Network tab: exactly one GET /tasks after the initial load (zero after returning)
#   - Sidebar badge updates from any page

# 5. Bisect-safety check
git log --oneline main..HEAD
# Every commit should be independently buildable. If splitting the work,
# put the new todoStore.ts content + test rewrite in the SAME commit as the
# delete of the Provider/Context (otherwise intermediate commits won't typecheck).
```

## Commit structure (single commit recommended)

Because Provider/Context deletes + `todoStore.ts` rewrite + consumer import updates form one logical change that must land together to typecheck, **one commit** is the right granularity:

```
refactor(todo): collapse store to Zustand module singleton

Remove TodoStoreProvider, TodoStoreContext, and the useTodoStore bridge
hook. Consolidate the store + per-action hooks into a single todoStore.ts
using `create` from 'zustand' directly. App.tsx fires init() via a
mount-once useEffect instead of a Provider's effect.

Behavior identical for end users — same fetch lifecycle, same selector
re-render semantics, same badge reactivity. Unit tests rewritten to use
module-singleton with `setState` reset in beforeEach. The Provider-guard
test is deleted (no Provider to require).

Files deleted: todoStoreContext.ts, TodoStoreProvider.tsx,
useTodoStore.ts, useTodoStore.test.tsx.
```

## PR body

```markdown
## Summary

Architectural simplification: collapse the Todo feature's "Zustand factory + React Context Provider" pattern to the canonical Zustand module-singleton shape. The Provider pattern was originally chosen to match the assignment's "wrap the app in a Provider" language; with the assignment graded, the indirection is pure ceremony.

## Why

Three files (Context + Provider + bridge hook) plus a Provider mount and `useContext` indirection in every consumer subscription, in exchange for: SSR safety we don't need, per-test store isolation that's adequately replaced by `setState` resets, and the literal "Provider" pattern of the assignment.

## Changes

- Rewritten: `todoStore.ts` uses `create` from 'zustand' directly; per-action hooks consolidated here.
- Deleted: `todoStoreContext.ts`, `TodoStoreProvider.tsx`, `useTodoStore.ts` (its content folded in), `useTodoStore.test.tsx` (Provider-guard test).
- Modified: `App.tsx` (drop Provider wrap, fire `init()` from a mount-once useEffect), `features/todo/index.ts` (drop Provider export), 3 consumer files (import path only).
- Unit tests rewritten: same assertions, access via `useTodoStore.getState()` / `useTodoStore.setState()`. 20/20 still green.

## Verified

- Lint, tsc, unit tests, E2E all green.
- Manual smoke at `/tasks`: cache-on-navigation, sidebar badge real-time updates, all unchanged.
```

## Out of scope (do not touch in this PR)

- `src/hooks/` (untracked, recent user experimentation)
- `CLAUDE.md`, `.mcp.json`, `.github/workflows/ci.yml`, `.claude/commands/check.md`, `src/components/ui/sonner.tsx`, `CounterButton.tsx`, `StatusBar.tsx`, `src/index.css` — pre-existing uncommitted drift
- `.impeccable/`, `DESIGN.md` — leftovers from earlier sessions

Stage only the in-scope files explicitly via `git add <path>`; never `git add -A`.
