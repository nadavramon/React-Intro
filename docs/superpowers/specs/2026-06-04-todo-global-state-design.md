# Todo Global State — Design Spec

**Date:** 2026-06-04
**Status:** Approved (pending user spec review)
**Scope:** Migrate the Todo feature from per-component local state to a single
global Zustand store, eliminate redundant server fetches on navigation, and
surface a live pending-task count in the Sidebar.

---

## 1. Problem

Today the Todo feature is owned by `src/features/todo/hooks/useTasks.ts` — a
custom hook that holds `tasks` in `useState` and runs `fetchTasks()` inside its
`useEffect(…, [])`. Because the hook is tied to the component that calls it
(`TodoPage`), every navigation away from `/tasks` unmounts the hook and loses
its state. Coming back to `/tasks` re-mounts the hook, re-fires the effect,
and the user sees the loading spinner again — even though the server data
hasn't changed.

We also have no way to read task state from outside the Todo feature. The
Sidebar lives in `src/layout/` and cannot show a pending-task badge today.

## 2. Goals

1. **Single source of truth** for tasks — one store, accessible anywhere.
2. **Fetch on app mount, not page mount** — no spinner on Todo re-entry.
3. **Real-time read from any component** — Sidebar shows live pending count.
4. **Keep the existing CRUD UX intact** — same look, same behaviors, just
   wired through a store.
5. **Idiomatic best practices** — selectors, idempotent init, StrictMode
   safety, no module-singleton side effects.

## 3. Non-goals (YAGNI)

- Optimistic mutations (current pessimistic / server-authoritative pattern stays).
- Per-task edit-title UI (not present today, not requested).
- Per-subtree multiple Todo stores (Provider is mounted once at app root).
- Replacing this with TanStack Query / React Query (different paradigm; the
  assignment scope is "global state management library," not "server-cache
  library").
- SSR support (Vite dev server is CSR-only). The Provider pattern is *SSR-safe*
  — that's a bonus, not a goal.

## 4. Approach

**The "store factory + React Context Provider" pattern from Zustand's docs.**

- A `createTodoStore()` factory builds a vanilla (non-React-bound) Zustand store.
- A `<TodoStoreProvider>` instantiates one store via `useRef` and exposes it
  through React Context. The init effect lives here.
- A `useTodoStore(selector)` hook combines `useContext` + Zustand's
  `useStore(store, selector)` so consumers get selector-based subscription
  semantics.

This was preferred over the simpler module-singleton (`export const useTodoStore
= create(…)`) because:

- The assignment explicitly says "wrap the app in a Provider."
- It's the SSR-safe shape Zustand recommends for app-router frameworks.
- It gives clean test isolation — each test renders a fresh `<TodoStoreProvider>`
  and gets a fresh store, no module-level resets needed.

## 5. Architecture

### 5.1 File layout

**New files** (`src/features/todo/store/`):

| File | Responsibility |
|---|---|
| `todoStore.ts` | `createTodoStore()` factory, `TodoState` type, action implementations. No React imports. |
| `TodoStoreProvider.tsx` | React Provider: lazy-init the store via `useRef`, fire the init `useEffect`, expose store via Context. |
| `useTodoStore.ts` | Selector hook + `useTodoActions()` convenience hook (with `useShallow`). |

**Modified files:**

| File | What changes |
|---|---|
| `src/App.tsx` | Wrap `<AppRoutes/>` in `<TodoStoreProvider>`. |
| `src/features/todo/TodoPage.tsx` | Replace `useTasks()` with store selectors; switch from `loading` boolean to `status` enum check. |
| `src/features/todo/components/TaskStats/TaskStats.tsx` | Drop `tasks` prop; subscribe to derived counts directly (3 narrow selectors). |
| `src/features/todo/components/AddTaskForm/AddTaskForm.tsx` | Drop `onAdd` prop; pull `addTask` from `useTodoActions()`. |
| `src/features/todo/components/TaskList/TaskList.tsx` | Drop `onToggle` prop; pull `toggleTask` from `useTodoActions()`. |
| `src/layout/Sidebar/Sidebar.tsx` | Add a pending-count pill to the "Todo" `NavLink`; subscribe to active count via narrow selector. |
| `src/features/todo/index.ts` | Re-export `TodoStoreProvider` and `useTodoStore`. |

**Deleted:**

- `src/features/todo/hooks/useTasks.ts` — fully replaced by the store.

### 5.2 Store shape

```ts
type TodoState = {
    // data
    tasks: Task[]

    // lifecycle
    status: 'idle' | 'loading' | 'ready' | 'error'
    errorMessage: string | null

    // actions
    init: () => Promise<void>
    addTask: (title: string) => Promise<void>
    toggleTask: (id: string) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    deleteCompleted: () => Promise<void>
}
```

**Why a 4-state `status` enum and not a `loading` boolean:**

| `status` | Meaning | UI behavior |
|---|---|---|
| `idle` | Provider mounted; init hasn't run yet. | Shouldn't render Todo content; transient state. |
| `loading` | First fetch in flight. | Show the loader. |
| `ready` | Initial fetch succeeded. Mutations from now on don't flip back to `loading`. | Show the task list. Re-entries to `/tasks` stay here. |
| `error` | Initial fetch failed. | Show the error message + retry. |

The critical property: **after `ready`, no action transitions back to `loading`**.
Mutations update `tasks` directly using the server response. This is what
delivers "no spinner on cache hits."

### 5.3 Provider + init flow

```tsx
// TodoStoreProvider.tsx
export function TodoStoreProvider({ children }: { children: ReactNode }) {
    const storeRef = useRef<TodoStore | null>(null)
    if (storeRef.current === null) storeRef.current = createTodoStore()

    useEffect(() => {
        storeRef.current!.getState().init()
    }, [])

    return (
        <TodoStoreContext.Provider value={storeRef.current}>{children}</TodoStoreContext.Provider>
    )
}
```

Three subtleties:

1. **`useRef` over `useState`**: the store is a stable mutable holder, not React
   state. `useState` would work but mis-signals intent.
2. **Lazy-init guard (`if (current === null)`)**: `useRef(createTodoStore())`
   would construct a fresh store on every render. The guard ensures one store
   per Provider lifetime.
3. **`init()` in `useEffect`, not in the factory**: keeps the factory pure
   (no side effects at construction), which matters for tests and for SSR.

### 5.4 `init()` — idempotent

```ts
init: async () => {
    if (get().status !== 'idle') return         // StrictMode safety
    set({ status: 'loading' })
    try {
        const tasks = await fetchTasks()
        set({ tasks, status: 'ready', errorMessage: null })
    } catch (err) {
        console.error('Failed to load tasks', err)
        set({ status: 'error', errorMessage: 'Could not load tasks. Please try again.' })
    }
}
```

React 19 StrictMode double-invokes effects in development. Without the guard,
we'd see two `GET /tasks` calls on mount. The `status !== 'idle'` check makes
`init()` safe to call any number of times.

### 5.5 Selector hook

```ts
export function useTodoStore<T>(selector: (state: TodoState) => T): T {
    const store = useContext(TodoStoreContext)
    if (store === null) throw new Error('useTodoStore must be used inside <TodoStoreProvider>')
    return useStore(store, selector)
}

export function useTodoActions() {
    return useTodoStore(
        useShallow((s) => ({
            addTask: s.addTask,
            toggleTask: s.toggleTask,
            deleteTask: s.deleteTask,
            deleteCompleted: s.deleteCompleted,
        })),
    )
}
```

`useShallow` is the canonical Zustand answer to selector-returns-an-object
re-render churn. Without it, `useTodoActions()` would return a new object
literal each call → reference inequality → re-render every store change. With
it, the selected object is shallow-compared; since action references are
stable, the consumer effectively never re-renders.

### 5.6 Consumer pattern

| Component | Selector(s) | Action(s) pulled |
|---|---|---|
| `TodoPage` | `s.status`, `s.errorMessage`, `s.tasks` | `deleteCompleted` (for the "Delete completed" button) |
| `TaskStats` | `s.tasks.length`, `s.tasks.filter(t => t.isCompleted).length` | None |
| `TaskList` | `s.tasks` (the array) | `toggleTask` |
| `TaskItem` | (none — receives task as prop) | (none) |
| `AddTaskForm` | (none) | `addTask` |
| `Sidebar` | `s.tasks.filter(t => !t.isCompleted).length` | None |

**`TaskItem` stays prop-driven.** Subscribing each row to its own task by id
would be more performant when one task changes among thousands — we have ~10.
YAGNI.

### 5.7 Sidebar badge

```tsx
const activeCount = useTodoStore((s) => s.tasks.filter((t) => !t.isCompleted).length)
// ...
<NavLink to={ROUTES.todo} className={…}>
    <span className="flex-1">Todo</span>
    {activeCount > 0 && (
        <span
            key={activeCount}                                  // re-mount → animate-pop
            aria-label={`${activeCount} active tasks`}
            className="bg-primary text-primary-foreground animate-pop inline-flex
                       h-5 min-w-5 items-center justify-center rounded-full px-1.5
                       text-[11px] font-semibold tabular-nums"
        >
            {activeCount}
        </span>
    )}
</NavLink>
```

Three details:
- **`key={activeCount}`** retriggers `animate-pop` on every change — free
  feedback that the number is live.
- **Hidden when zero** — a "0" pill reads as visual noise once everything's
  done.
- **`tabular-nums`** prevents width jitter on single→double-digit crossover.

## 6. Data flow

```
                                                         ┌─────────────┐
                                                         │   Sidebar   │
                                                         │  (badge)    │
                                                         └──────┬──────┘
                                                                │
                                                        useTodoStore(activeCount)
                                                                │
┌──────────────┐    1. mount        ┌──────────────────┐        ▼
│  App.tsx     │───────────────────▶│ TodoStoreProvider│◀──── (store) ─────▶ TodoPage / TaskStats /
│  <Provider>  │                    │  - useRef store  │                     TaskList / AddTaskForm
└──────────────┘                    │  - useEffect→init│                     (selectors + actions)
                                    └────────┬─────────┘
                                             │
                                             │ init() (idempotent)
                                             ▼
                                       fetchTasks()  ─────▶ axios ─────▶ Express server
                                             │
                                             ▼
                                       set({tasks, status:'ready'})
```

Subsequent navigation away from `/tasks` does **not** unmount the Provider —
only the page-level routes change. The store persists; `tasks` stays in memory;
no refetch on return.

## 7. Migration order

1. `npm install zustand`. After install, check `git diff package-lock.json`
   for unexpected deletions (cross-platform peer drift from memory). If the
   diff is dirty, regenerate the lockfile in Docker (`node:22-alpine`).
2. Create `todoStore.ts` (factory + state + actions).
3. Create `TodoStoreProvider.tsx` (Provider + init effect).
4. Create `useTodoStore.ts` (selector hook + `useTodoActions`).
5. Export from `features/todo/index.ts`.
6. Wrap `App.tsx` in `<TodoStoreProvider>`.
7. Refactor `TodoPage` to use store selectors.
8. Refactor `TaskStats` (drop prop, narrow selectors).
9. Refactor `AddTaskForm` (drop prop, pull action).
10. Refactor `TaskList` (drop prop, pull action).
11. Add badge to `Sidebar`.
12. Delete `hooks/useTasks.ts`.
13. Run `/check`; fix any fallout.

Each step is a logical commit boundary.

## 8. Testing strategy

### 8.1 Unit (Vitest) — store actions

`src/features/todo/store/todoStore.test.ts`. Mock `tasksApi` with `vi.mock`.
Test cases:

- `init()` transitions `idle → loading → ready` on success.
- `init()` transitions `idle → loading → error` on fetch failure.
- `init()` against a non-`idle` store is a no-op (idempotency).
- `addTask(title)` appends server-returned task to `tasks`.
- `addTask('  ')` (whitespace-only) is a no-op.
- `toggleTask(id)` updates only the targeted task.
- `deleteTask(id)` removes only the targeted task.
- `deleteCompleted()` removes all completed tasks in one batch.

Fresh store per test via `createTodoStore()`. No module-level resets needed.

### 8.2 E2E (Playwright) — the assignment requirement

`e2e/todo-global-state.spec.ts`:

```ts
test('navigating away and back does not refetch /tasks', async ({ page }) => {
    const getRequests: string[] = []
    page.on('request', (r) => {
        if (r.url().includes('/tasks') && r.method() === 'GET') getRequests.push(r.url())
    })
    await page.goto('/tasks')
    await expect(page.getByText('Loading tasks…')).toBeHidden()
    await page.getByRole('link', { name: 'Tic-Tac-Toe' }).click()
    await page.getByRole('link', { name: 'Todo' }).click()
    expect(getRequests).toHaveLength(1)
})

test('Sidebar badge reflects active count in real time', async ({ page }) => {
    await page.goto('/tasks')
    await page.getByPlaceholder(/add/i).fill('Test task')
    await page.getByRole('button', { name: /add/i }).click()
    await expect(page.getByLabel(/active tasks/i)).toContainText('1')
})
```

The first test is the literal-spec encoding of "avoid redundant recurring
loadings from the server."

## 9. Best practices applied

| Practice | Where |
|---|---|
| Narrow selectors → minimal re-renders | Every consumer subscribes to the smallest slice |
| `useShallow` for object-returning selectors | `useTodoActions()` |
| Idempotent init | `init()` guards on `status !== 'idle'` |
| `status` enum vs. boolean `loading` | Distinguishes uninitialized from in-flight; no spinner on cache hits |
| Server-authoritative state | Mutations use server's returned object (no optimistic guess) |
| Factory body has no side effects | `init()` lives in Provider's effect, not in `createTodoStore()` |
| Stable action references | Actions defined once in store creation; never replaced |
| `useRef` + lazy-init guard | Provider construction pattern |
| Feature exports via `index.ts` | Cross-feature import (Sidebar → todo) uses the public surface |

## 10. Open questions / future work

- Should `init()` retry on transient network failure? Currently no — the user
  refreshes. Acceptable for a learning project.
- Should the store persist to `localStorage` (e.g. via `zustand/middleware`)?
  Out of scope; server is the source of truth.
- Should we extract a generic `createApiResourceStore<T>()` helper for future
  features (e.g. counters)? Premature abstraction — revisit when the second
  feature needs the same pattern.
