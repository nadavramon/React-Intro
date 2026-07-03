# Todo Global State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the Todo feature from per-component local state to a single global Zustand store, eliminate redundant server fetches on navigation, and add a live pending-task count badge to the Sidebar.

**Architecture:** Zustand "store factory + React Context Provider" pattern. A vanilla `createTodoStore()` factory builds the store; `<TodoStoreProvider>` instantiates one instance via `useState(() => createTodoStore())` (the React 19 idiom — `useRef` trips the new `react-hooks/refs` rule), fires `init()` from a `useEffect` (once on mount, StrictMode-safe), and exposes the store through Context. Consumers subscribe via `useTodoStore(selector)` for narrow re-renders.

**Tech Stack:** Zustand 5.x (`zustand` + `zustand/vanilla` + `zustand/react/shallow`), React 19, TypeScript strict, Vitest + RTL for unit/component tests, Playwright for E2E.

**Spec:** [docs/superpowers/specs/2026-06-04-todo-global-state-design.md](../specs/2026-06-04-todo-global-state-design.md)

**Working branch:** `feature/todo-global-state` (create from `main`).

---

## File map

**Create:**
- `src/features/todo/store/todoStore.ts` — vanilla store factory, state type, action implementations
- `src/features/todo/store/todoStoreContext.ts` — React Context (separate from Provider to satisfy `react-refresh/only-export-components`)
- `src/features/todo/store/TodoStoreProvider.tsx` — React Provider + init effect
- `src/features/todo/store/useTodoStore.ts` — selector hook + `useTodoActions()` convenience
- `src/features/todo/store/todoStore.test.ts` — unit tests for store actions
- `src/features/todo/store/useTodoStore.test.tsx` — test for "throws outside Provider"
- `e2e/todo-global-state.spec.ts` — E2E for cache-on-navigation + badge

**Modify:**
- `src/App.tsx` — wrap `<AppRoutes/>` in `<TodoStoreProvider>`
- `src/features/todo/index.ts` — re-export `TodoStoreProvider` and `useTodoStore`
- `src/features/todo/TodoPage.tsx` — replace `useTasks()` with store selectors + `useTodoActions()`
- `src/features/todo/components/TaskStats/TaskStats.tsx` — drop `tasks` prop; select counts from store
- `src/features/todo/components/AddTaskForm/AddTaskForm.tsx` — drop `onAdd` prop; pull `addTask` from store
- `src/features/todo/components/TaskList/TaskList.tsx` — drop `onToggle` prop; pull `toggleTask` from store
- `src/layout/Sidebar/Sidebar.tsx` — add pending-count pill on the Todo `NavLink`
- `playwright.config.ts` — set `workers: 1` (dev backend can't handle concurrent auth flows)

**Delete:**
- `src/features/todo/hooks/useTasks.ts`
- `src/features/todo/hooks/` directory (empty afterwards)

---

## Task 1: Branch + install Zustand

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Create the working branch from main**

```bash
git checkout main
git pull
git checkout -b feature/todo-global-state
```

- [ ] **Step 2: Install Zustand**

```bash
npm install zustand
```

Expected: `package.json` and `package-lock.json` updated. Zustand pulls no runtime peer dependencies.

- [ ] **Step 3: Inspect the lockfile diff for cross-platform drift**

```bash
git diff package-lock.json | head -200
```

**Why this matters:** npm 11.x on macOS has been observed to silently delete optional-peer entries (e.g. `@emnapi/core`, `@emnapi/runtime`) that Linux CI needs. The local install succeeds, then CI fails with `npm error Missing: @emnapi/X from lock file`. Always read the lockfile diff for *deletions*, not just additions.

**Expected:** additions for `zustand` and its sub-packages only. **If you see `@emnapi/*`, `@parcel/*`, or `@swc/*-linux-*` entries being deleted, do not commit.** Run Step 4 instead.

- [ ] **Step 4: (Only if Step 3 showed unexpected deletions) Regenerate the lockfile in a Linux container**

```bash
git checkout origin/main -- package-lock.json
docker run --rm -v "$(pwd):/app" -w /app node:22-alpine sh -c "rm -rf node_modules && npm install --no-audit --no-fund"
```

This runs the install inside the same `node:22-alpine` image our CI uses, so the resulting lockfile has all cross-platform peer entries intact. Takes ~25 seconds.

- [ ] **Step 5: Verify Zustand installed correctly**

```bash
node -e "console.log(require('zustand/package.json').version)"
```

Expected: prints a version like `5.0.x`.

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json
git commit -m "Install zustand for global state management"
```

---

## Task 2: Define the store types and skeleton

**Files:**
- Create: `src/features/todo/store/todoStore.ts`

- [ ] **Step 1: Create the store directory and the skeleton file**

```bash
mkdir -p src/features/todo/store
```

Create `src/features/todo/store/todoStore.ts` with the type and a minimal (empty) factory. We'll fill in the actions across the next tasks via TDD.

```ts
import { createStore } from 'zustand/vanilla'
import type { Task } from '@/features/todo/types'
import { createTask, deleteTask, fetchTasks, updateTask } from '@/features/todo/api/tasksApi'

export type TodoStatus = 'idle' | 'loading' | 'ready' | 'error'

export type TodoState = {
    // data
    tasks: Task[]

    // lifecycle
    status: TodoStatus
    errorMessage: string | null

    // actions
    init: () => Promise<void>
    addTask: (title: string) => Promise<void>
    toggleTask: (id: string) => Promise<void>
    deleteTask: (id: string) => Promise<void>
    deleteCompleted: () => Promise<void>
}

export type TodoStore = ReturnType<typeof createTodoStore>

export function createTodoStore() {
    return createStore<TodoState>((set, get) => ({
        tasks: [],
        status: 'idle',
        errorMessage: null,

        init: async () => {
            // Idempotency guard: StrictMode double-invokes effects in dev, and we
            // never want a second GET /tasks against an already-initialized store.
            if (get().status !== 'idle') return
            set({ status: 'loading' })
            try {
                const tasks = await fetchTasks()
                set({ tasks, status: 'ready', errorMessage: null })
            } catch (err) {
                console.error('Failed to load tasks', err)
                set({
                    status: 'error',
                    errorMessage: 'Could not load tasks. Please try again.',
                })
            }
        },

        addTask: async (title: string) => {
            const trimmed = title.trim()
            if (trimmed === '') return
            try {
                const created = await createTask(trimmed)
                set((state) => ({ tasks: [...state.tasks, created] }))
            } catch (err) {
                console.error('Failed to add task', err)
                throw err
            }
        },

        toggleTask: async (id: string) => {
            const task = get().tasks.find((t) => t.id === id)
            if (!task) return
            try {
                const updated = await updateTask(id, { isCompleted: !task.isCompleted })
                set((state) => ({
                    tasks: state.tasks.map((t) => (t.id === id ? updated : t)),
                }))
            } catch (err) {
                console.error('Failed to toggle task', err)
                throw err
            }
        },

        deleteTask: async (id: string) => {
            try {
                await deleteTask(id)
                set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) }))
            } catch (err) {
                console.error('Failed to delete task', err)
                throw err
            }
        },

        deleteCompleted: async () => {
            const completed = get().tasks.filter((t) => t.isCompleted)
            try {
                await Promise.all(completed.map((t) => deleteTask(t.id)))
                set((state) => ({ tasks: state.tasks.filter((t) => !t.isCompleted) }))
            } catch (err) {
                console.error('Failed to delete completed tasks', err)
                throw err
            }
        },
    }))
}
```

**Why actions `throw` instead of `toast`:** the store is framework-agnostic — it doesn't know about `sonner`. The component that *calls* an action catches and toasts. This keeps the store testable without mocking a UI library.

- [ ] **Step 2: Run typecheck (the PostToolUse hook will also catch this)**

```bash
npx tsc -b
```

Expected: no errors. The imports and types resolve.

---

## Task 3: Unit-test the store actions (TDD)

**Files:**
- Create: `src/features/todo/store/todoStore.test.ts`

- [ ] **Step 1: Write the test file**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { Task } from '@/features/todo/types'
import { createTodoStore } from './todoStore'

// Mock the tasks API. Each test sets the mock return value before acting.
vi.mock('@/features/todo/api/tasksApi', () => ({
    fetchTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
}))

// Import after the mock so vi.mocked typing works.
import { createTask, deleteTask, fetchTasks, updateTask } from '@/features/todo/api/tasksApi'

const mockedFetch = vi.mocked(fetchTasks)
const mockedCreate = vi.mocked(createTask)
const mockedUpdate = vi.mocked(updateTask)
const mockedDelete = vi.mocked(deleteTask)

const TASK_A: Task = { id: 'a', title: 'A', isCompleted: false }
const TASK_B: Task = { id: 'b', title: 'B', isCompleted: true }

beforeEach(() => {
    vi.clearAllMocks()
})

describe('todoStore', () => {
    describe('init()', () => {
        it('starts in idle status with no tasks', () => {
            const store = createTodoStore()
            expect(store.getState().status).toBe('idle')
            expect(store.getState().tasks).toEqual([])
        })

        it('transitions idle → loading → ready on success', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            const store = createTodoStore()

            const promise = store.getState().init()
            expect(store.getState().status).toBe('loading')

            await promise
            expect(store.getState().status).toBe('ready')
            expect(store.getState().tasks).toEqual([TASK_A, TASK_B])
            expect(store.getState().errorMessage).toBeNull()
        })

        it('transitions idle → loading → error on failure', async () => {
            mockedFetch.mockRejectedValueOnce(new Error('boom'))
            const store = createTodoStore()

            await store.getState().init()
            expect(store.getState().status).toBe('error')
            expect(store.getState().errorMessage).toBe(
                'Could not load tasks. Please try again.',
            )
        })

        it('is idempotent — second call against non-idle store is a no-op', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A])
            const store = createTodoStore()

            await store.getState().init()
            await store.getState().init() // should NOT fire a second request

            expect(mockedFetch).toHaveBeenCalledTimes(1)
        })
    })

    describe('addTask()', () => {
        it('appends the server-returned task to state', async () => {
            mockedCreate.mockResolvedValueOnce(TASK_A)
            const store = createTodoStore()

            await store.getState().addTask('A')

            expect(store.getState().tasks).toEqual([TASK_A])
            expect(mockedCreate).toHaveBeenCalledWith('A')
        })

        it('trims whitespace before calling the server', async () => {
            mockedCreate.mockResolvedValueOnce(TASK_A)
            const store = createTodoStore()

            await store.getState().addTask('  A  ')

            expect(mockedCreate).toHaveBeenCalledWith('A')
        })

        it('is a no-op for whitespace-only titles', async () => {
            const store = createTodoStore()

            await store.getState().addTask('   ')

            expect(mockedCreate).not.toHaveBeenCalled()
            expect(store.getState().tasks).toEqual([])
        })
    })

    describe('toggleTask()', () => {
        it('flips isCompleted on the targeted task only', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            mockedUpdate.mockResolvedValueOnce({ ...TASK_A, isCompleted: true })

            const store = createTodoStore()
            await store.getState().init()

            await store.getState().toggleTask('a')

            expect(mockedUpdate).toHaveBeenCalledWith('a', { isCompleted: true })
            expect(store.getState().tasks[0]).toEqual({ ...TASK_A, isCompleted: true })
            expect(store.getState().tasks[1]).toEqual(TASK_B) // unchanged
        })

        it('is a no-op when the id is not found', async () => {
            const store = createTodoStore()
            await store.getState().toggleTask('nonexistent')
            expect(mockedUpdate).not.toHaveBeenCalled()
        })
    })

    describe('deleteTask()', () => {
        it('removes the task and calls the server', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            mockedDelete.mockResolvedValueOnce(undefined)

            const store = createTodoStore()
            await store.getState().init()
            await store.getState().deleteTask('a')

            expect(mockedDelete).toHaveBeenCalledWith('a')
            expect(store.getState().tasks).toEqual([TASK_B])
        })
    })

    describe('deleteCompleted()', () => {
        it('removes all completed tasks in a single batch', async () => {
            mockedFetch.mockResolvedValueOnce([TASK_A, TASK_B])
            mockedDelete.mockResolvedValue(undefined)

            const store = createTodoStore()
            await store.getState().init()
            await store.getState().deleteCompleted()

            expect(mockedDelete).toHaveBeenCalledTimes(1) // only TASK_B is completed
            expect(mockedDelete).toHaveBeenCalledWith('b')
            expect(store.getState().tasks).toEqual([TASK_A])
        })
    })
})
```

- [ ] **Step 2: Run the tests**

```bash
npm run test:run -- src/features/todo/store/todoStore.test.ts
```

Expected: all tests PASS. (We wrote the implementation in Task 2 alongside the type to keep the file coherent; the test acts as the spec executor.)

If any test fails, the failure points to a real bug in Task 2's implementation — fix it there before moving on.

- [ ] **Step 3: Commit**

```bash
git add src/features/todo/store/todoStore.ts src/features/todo/store/todoStore.test.ts
git commit -m "Add todoStore factory with init, CRUD actions, and unit tests"
```

---

## Task 4: Create the Context and Provider

**Files:**
- Create: `src/features/todo/store/todoStoreContext.ts`
- Create: `src/features/todo/store/TodoStoreProvider.tsx`

**Two files, not one.** Two React 19 lint rules push us to split them:

1. **`react-refresh/only-export-components`** — a file exporting a component (the Provider) cannot also export non-components (the Context). Fast Refresh / HMR can't reliably reload such files. So the Context lives in its own `.ts` file.
2. **`react-hooks/refs`** — reading `ref.current` during render is a lint error in React 19. The `useRef + lazy-init guard` pattern from the React 18 era trips this rule. The modern idiom for "set once, never replace" is `useState(() => createX())`. The setter is unused; the initializer is guaranteed to run exactly once.

- [ ] **Step 1: Create the Context file**

Create `src/features/todo/store/todoStoreContext.ts`:

```ts
import { createContext } from 'react'
import type { TodoStore } from './todoStore'

export const TodoStoreContext = createContext<TodoStore | null>(null)
```

Three lines. Just the Context. No components.

- [ ] **Step 2: Write the Provider**

Create `src/features/todo/store/TodoStoreProvider.tsx`:

```tsx
import { useEffect, useState, type ReactNode } from 'react'
import { createTodoStore } from './todoStore'
import { TodoStoreContext } from './todoStoreContext'

type Props = {
    children: ReactNode
}

export function TodoStoreProvider({ children }: Props) {
    // useState with lazy initializer (not useRef). React 19's react-hooks/refs
    // rule treats ref.current reads during render as a lint error. useState's
    // initializer is guaranteed to run exactly once per mount and returns a
    // stable, lint-safe singleton for the lifetime of this Provider.
    const [store] = useState(() => createTodoStore())

    // Fire the initial fetch. init() is idempotent — see the guard in todoStore.ts —
    // so StrictMode's double-invoke in dev is harmless.
    useEffect(() => {
        store.getState().init()
    }, [store])

    return <TodoStoreContext.Provider value={store}>{children}</TodoStoreContext.Provider>
}
```

- [ ] **Step 3: Verify typecheck**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/features/todo/store/todoStoreContext.ts src/features/todo/store/TodoStoreProvider.tsx
git commit -m "Add TodoStoreContext and Provider with useState lazy initializer"
```

---

## Task 5: Create the selector hook (useTodoStore + useTodoActions)

**Files:**
- Create: `src/features/todo/store/useTodoStore.ts`

- [ ] **Step 1: Write the hook file**

```ts
import { useContext } from 'react'
import { useStore } from 'zustand'
import { useShallow } from 'zustand/react/shallow'
import { TodoStoreContext } from './todoStoreContext'
import type { TodoState } from './todoStore'

/**
 * Subscribe to a slice of the Todo store with a selector.
 * Components re-render only when the selected slice changes.
 *
 * Throws if called outside a <TodoStoreProvider>.
 */
export function useTodoStore<T>(selector: (state: TodoState) => T): T {
    const store = useContext(TodoStoreContext)
    if (store === null) {
        throw new Error('useTodoStore must be used inside <TodoStoreProvider>')
    }
    return useStore(store, selector)
}

/**
 * Convenience hook for grabbing all actions at once.
 *
 * Wrapped in useShallow because the selector returns a fresh object literal
 * every call. Without useShallow, every store update would create a new
 * reference and re-render the consumer. With it, the object is shallow-compared
 * and the consumer effectively never re-renders (action refs are stable).
 */
export function useTodoActions() {
    return useTodoStore(
        useShallow((state) => ({
            addTask: state.addTask,
            toggleTask: state.toggleTask,
            deleteTask: state.deleteTask,
            deleteCompleted: state.deleteCompleted,
        })),
    )
}
```

- [ ] **Step 2: Write a test that the hook throws when used outside the Provider**

Create `src/features/todo/store/useTodoStore.test.tsx`:

```tsx
import { renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useTodoStore } from './useTodoStore'

describe('useTodoStore', () => {
    it('throws when called outside <TodoStoreProvider>', () => {
        // renderHook surfaces the throw via the result.error path, but React 19
        // also logs to console.error — silence it for a clean test report.
        const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

        expect(() => {
            renderHook(() => useTodoStore((s) => s.tasks))
        }).toThrow('useTodoStore must be used inside <TodoStoreProvider>')

        errorSpy.mockRestore()
    })
})
```

- [ ] **Step 3: Run the tests**

```bash
npm run test:run -- src/features/todo/store/useTodoStore.test.tsx
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/features/todo/store/useTodoStore.ts src/features/todo/store/useTodoStore.test.tsx
git commit -m "Add useTodoStore selector hook and useTodoActions convenience"
```

---

## Task 6: Export the Provider and hooks from features/todo/index.ts

**Files:**
- Modify: `src/features/todo/index.ts`

- [ ] **Step 1: Update the index**

```ts
export { default } from './TodoPage'
export { TodoStoreProvider } from './store/TodoStoreProvider'
export { useTodoStore, useTodoActions } from './store/useTodoStore'
```

**Why this matters:** the Sidebar (in `src/layout/Sidebar/Sidebar.tsx`) lives outside the Todo feature. It will import `useTodoStore` to read the active count. Per the project convention — "Import features through their `index.ts`, not deep paths" — that import must be `from '@/features/todo'`. The default export stays so `AppRoutes.tsx`'s existing `import TodoPage from '@/features/todo'` keeps working.

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc -b
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/features/todo/index.ts
git commit -m "Export TodoStoreProvider and useTodoStore from features/todo"
```

---

## Task 7: Wrap the app in TodoStoreProvider

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx**

```tsx
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './AppRoutes'
import { Toaster } from '@/components/ui/sonner'
import { TodoStoreProvider } from '@/features/todo'

export default function App() {
    return (
        <BrowserRouter>
            <TodoStoreProvider>
                <AppRoutes />
            </TodoStoreProvider>
            <Toaster richColors position="top-right" />
        </BrowserRouter>
    )
}
```

**Why the Provider goes *inside* `<BrowserRouter>` and *outside* `<AppRoutes>`:** the Provider needs to wrap every route that consumes the store (`/tasks` directly, plus the Sidebar which is rendered for *all* routes via the Layout). Putting it inside the router is fine — it doesn't need any router context. Putting it inside `<AppRoutes>` would scope the store to one route, defeating the cache-on-navigation goal.

- [ ] **Step 2: Manually verify nothing broke**

```bash
npm run dev
```

In the browser at `http://localhost:5173/tasks`:
- The Todo page should still load (the old `useTasks` hook is still alive — Task 14 deletes it).
- Open the Network tab. You should see exactly **one** `GET /tasks` request — the Provider's init fired, and the legacy hook fires its own request too if you're on /tasks. (This double-fetch is temporary; it goes away in Task 8.)
- Switch to Counters then back to Todo — there will currently still be a refetch (the legacy hook still owns the page). The cache behavior arrives in Task 8.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "Wrap app in TodoStoreProvider"
```

---

## Task 8: Refactor TodoPage to use the store

**Files:**
- Modify: `src/features/todo/TodoPage.tsx`

- [ ] **Step 1: Replace useTasks with store selectors**

```tsx
import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useTodoActions, useTodoStore } from './store/useTodoStore'
import AddTaskForm from './components/AddTaskForm/AddTaskForm'
import SearchBar from './components/SearchBar/SearchBar'
import TaskStats from './components/TaskStats/TaskStats'
import TaskList from './components/TaskList/TaskList'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export default function TodoPage() {
    // Three narrow selectors instead of one big destructure: each subscribes to
    // its own slice, so editing the search input doesn't trigger re-evaluations
    // tied to `status` or `errorMessage`.
    const status = useTodoStore((s) => s.status)
    const errorMessage = useTodoStore((s) => s.errorMessage)
    const tasks = useTodoStore((s) => s.tasks)
    const { deleteCompleted } = useTodoActions()

    const [searchQuery, setSearchQuery] = useState('')

    const filteredTasks = useMemo(
        () => tasks.filter((task) => task.title.toLowerCase().includes(searchQuery.toLowerCase())),
        [tasks, searchQuery],
    )

    // Loader only on the very first fetch. Subsequent navigations stay in
    // `ready` and skip this branch — that's the whole point of the migration.
    if (status === 'idle' || status === 'loading') {
        return (
            <main className="mx-auto flex min-h-full max-w-2xl items-center justify-center px-6 py-14">
                <div className="text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    <span>Loading tasks…</span>
                </div>
            </main>
        )
    }

    if (status === 'error') {
        return (
            <main className="mx-auto flex min-h-full max-w-2xl items-center justify-center px-6 py-14">
                <p className="text-destructive">{errorMessage}</p>
            </main>
        )
    }

    async function handleDeleteCompleted() {
        try {
            const count = tasks.filter((t) => t.isCompleted).length
            await deleteCompleted()
            toast.success(`Deleted ${count} task${count === 1 ? '' : 's'}`)
        } catch {
            toast.error('Failed to delete tasks')
        }
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-14">
            <header className="flex flex-col gap-1">
                <h1 className="text-foreground text-3xl font-bold tracking-tight">Todo</h1>
                <p className="text-muted-foreground text-sm">Track your tasks</p>
            </header>
            <AddTaskForm />
            <SearchBar query={searchQuery} onQueryChange={setSearchQuery} />
            <TaskStats />
            <Button
                className="self-start"
                variant="destructive"
                onClick={handleDeleteCompleted}
                disabled={!tasks.some((t) => t.isCompleted)}
            >
                Delete completed
            </Button>
            {filteredTasks.length === 0 ? (
                <p className="text-muted-foreground text-sm">
                    {tasks.length === 0
                        ? 'No tasks yet. Add one above.'
                        : `No tasks match "${searchQuery}".`}
                </p>
            ) : (
                <TaskList tasks={filteredTasks} />
            )}
        </main>
    )
}
```

**Notice three changes beyond "swap hooks":**
1. `<AddTaskForm />` and `<TaskStats />` no longer receive props — they'll pull from the store themselves in Tasks 9 and 10.
2. `<TaskList tasks={filteredTasks} />` still takes a `tasks` prop because TodoPage owns the *filtered* view; TaskList just renders what it's given (its toggle action comes from the store in Task 11).
3. The "delete completed" toast moved from the store action to the page. The store throws on failure; the page catches and toasts. This is the framework-agnostic boundary the store maintains.

- [ ] **Step 2: TypeScript will complain about TaskStats/AddTaskForm/TaskList prop mismatches**

That's expected — the next three tasks fix each one. The `PostToolUse` `tsc` hook will surface these errors right after the edit.

If you want to make the build green while you work, you can add `// @ts-expect-error wired in Task N` comments above the three offending lines as temporary scaffolding, then remove them as each subcomponent is migrated. (Skip this if you're doing all three tasks in one sitting — the typecheck will be green by the end of Task 11.)

- [ ] **Step 3: Manual smoke (still has type errors — that's OK)**

```bash
npm run dev
```

The page will fail to compile until Tasks 9–11 are done. Move on directly.

---

## Task 9: Refactor AddTaskForm to pull addTask from the store

**Files:**
- Modify: `src/features/todo/components/AddTaskForm/AddTaskForm.tsx`

- [ ] **Step 1: Update AddTaskForm**

```tsx
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { useTodoActions } from '@/features/todo/store/useTodoStore'

export default function AddTaskForm() {
    const { addTask } = useTodoActions()
    const [title, setTitle] = useState('')

    async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        try {
            await addTask(title)
            setTitle('')
            toast.success('Task added')
        } catch {
            toast.error('Failed to add task')
        }
    }

    return (
        <form className="flex gap-2" onSubmit={handleSubmit}>
            <input
                className="bg-card text-foreground placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-primary/30 flex-1 rounded-md border px-3 py-2 text-sm outline-none transition focus-visible:ring-2"
                type="text"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                aria-label="New task"
                placeholder="New task..."
            />
            <Button type="submit" disabled={title.trim() === ''}>
                Add
            </Button>
        </form>
    )
}
```

**Two subtle behavior changes worth flagging:**
1. `setTitle('')` only runs *after* `addTask` resolves successfully. On error the input keeps the user's typed text (better UX than clearing on failure).
2. The toast wiring moved into the component — same pattern as TodoPage's `handleDeleteCompleted`.

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc -b
```

Expected: this file is clean. (Other files may still be red from Task 8 — that's expected.)

- [ ] **Step 3: Commit**

```bash
git add src/features/todo/components/AddTaskForm/AddTaskForm.tsx
git commit -m "Refactor AddTaskForm to consume useTodoActions"
```

---

## Task 10: Refactor TaskStats to subscribe directly

**Files:**
- Modify: `src/features/todo/components/TaskStats/TaskStats.tsx`

- [ ] **Step 1: Update TaskStats**

```tsx
import { useTodoStore } from '@/features/todo/store/useTodoStore'

const STAT_CARD = 'bg-card flex flex-1 flex-col items-center gap-1 rounded-md border p-4'

export default function TaskStats() {
    // Three narrow selectors — TaskStats re-renders only when these specific
    // numbers change. Toggling a task changes `completed` and `active`;
    // adding/deleting changes `total`. The whole tasks array could be replaced
    // wholesale and this component still wouldn't churn unless a number moved.
    const total = useTodoStore((s) => s.tasks.length)
    const completed = useTodoStore((s) => s.tasks.filter((t) => t.isCompleted).length)
    const active = total - completed

    return (
        <div className="flex gap-3">
            <div className={STAT_CARD}>
                <span className="text-muted-foreground text-xs tracking-wide uppercase">Total</span>
                <span className="text-foreground text-2xl font-bold tabular-nums">{total}</span>
            </div>
            <div className={STAT_CARD}>
                <span className="text-muted-foreground text-xs tracking-wide uppercase">Active</span>
                <span className="text-foreground text-2xl font-bold tabular-nums">{active}</span>
            </div>
            <div className={STAT_CARD}>
                <span className="text-muted-foreground text-xs tracking-wide uppercase">
                    Completed
                </span>
                <span className="text-primary text-2xl font-bold tabular-nums">{completed}</span>
            </div>
        </div>
    )
}
```

- [ ] **Step 2: Verify typecheck**

```bash
npx tsc -b
```

Expected: this file is clean.

- [ ] **Step 3: Commit**

```bash
git add src/features/todo/components/TaskStats/TaskStats.tsx
git commit -m "Refactor TaskStats to subscribe to store counts directly"
```

---

## Task 11: Refactor TaskList to pull toggleTask from the store

**Files:**
- Modify: `src/features/todo/components/TaskList/TaskList.tsx`
- Modify: `src/features/todo/components/TaskList/TaskItem/TaskItem.tsx`

- [ ] **Step 1: Update TaskList**

```tsx
import { toast } from 'sonner'
import type { Task } from '@/features/todo/types'
import { useTodoActions } from '@/features/todo/store/useTodoStore'
import TaskItem from './TaskItem/TaskItem'

type TaskListProps = {
    tasks: Task[]
}

export default function TaskList({ tasks }: TaskListProps) {
    const { toggleTask } = useTodoActions()

    async function handleToggle(id: string, willBeCompleted: boolean) {
        try {
            await toggleTask(id)
            toast.success(willBeCompleted ? 'Task completed' : 'Task marked active')
        } catch {
            toast.error('Failed to update task')
        }
    }

    return (
        <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
                <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggle(task.id, !task.isCompleted)}
                />
            ))}
        </ul>
    )
}
```

**Why TaskList still takes a `tasks` prop:** TodoPage applies the search filter and decides *which* tasks to render. TaskList is a pure presenter over that filtered slice — same role as before. Only the action wiring moved into the store.

- [ ] **Step 2: Update TaskItem's onToggle signature**

The old signature was `onToggle: (id: string) => void` (TaskList knew the id and passed it). The new signature is `onToggle: () => void` (TaskList binds the id and toast text at render time):

```tsx
import type { Task } from '@/features/todo/types'
import { cn } from '@/lib/utils'

type TaskItemProps = {
    task: Task
    onToggle: () => void
}

export default function TaskItem({ task, onToggle }: TaskItemProps) {
    return (
        <li
            className={cn(
                'bg-card animate-slide-in flex items-center gap-3 rounded-md border px-4 py-3 transition',
                task.isCompleted && 'opacity-60',
            )}
        >
            <input
                type="checkbox"
                className="accent-primary size-4 cursor-pointer"
                checked={task.isCompleted}
                onChange={onToggle}
                aria-label={task.isCompleted ? 'Mark as not done' : 'Mark as done'}
            />
            <span
                className={cn(
                    'text-foreground flex-1 text-sm',
                    task.isCompleted && 'text-muted-foreground line-through',
                )}
            >
                {task.title}
            </span>
        </li>
    )
}
```

- [ ] **Step 3: Run typecheck — should now be green across the board**

```bash
npx tsc -b
```

Expected: no errors. All TodoPage's prop-shape complaints from Task 8 are now satisfied.

- [ ] **Step 4: Manual smoke test in the browser**

```bash
npm run dev
```

At `http://localhost:5173/tasks`:
- The page loads with the spinner, then your existing tasks appear.
- Add a task → it shows up, success toast appears.
- Toggle a task → checkbox flips, toast appears.
- Click "Delete completed" → all checked tasks vanish.
- **The key test:** navigate to `/counters`, then back to `/tasks`. **No spinner.** Tasks appear immediately. (Open the Network tab to confirm: zero new `GET /tasks` requests on return.)

- [ ] **Step 5: Commit**

```bash
git add src/features/todo/TodoPage.tsx src/features/todo/components/TaskList/TaskList.tsx src/features/todo/components/TaskList/TaskItem/TaskItem.tsx
git commit -m "Wire TodoPage, TaskList, TaskItem to the global store"
```

---

## Task 12: Drop the toggle success toast (keep the error)

**Files:**
- Modify: `src/features/todo/components/TaskList/TaskList.tsx`

The "Task completed" / "Task marked active" toast on every checkbox click is too noisy — the user sees the box flip immediately, the toast adds nothing. **Keep the error toast**: a server-side toggle failure is genuinely surprising and silently reverting the checkbox would leave the user confused. "Silent on success, vocal on failure" is the standard UX shape.

The `addTask` success toast and `deleteCompleted` success toast stay as-is — those mutations don't have an immediately-visible state change like a checkbox flip does.

- [ ] **Step 1: Simplify `handleToggle` in TaskList**

Open [src/features/todo/components/TaskList/TaskList.tsx](src/features/todo/components/TaskList/TaskList.tsx) and replace the file contents with:

```tsx
import { toast } from 'sonner'
import type { Task } from '@/features/todo/types'
import { useTodoActions } from '@/features/todo/store/useTodoStore'
import TaskItem from './TaskItem/TaskItem'

type TaskListProps = {
    tasks: Task[]
}

export default function TaskList({ tasks }: TaskListProps) {
    const { toggleTask } = useTodoActions()

    async function handleToggle(id: string) {
        try {
            await toggleTask(id)
        } catch {
            toast.error('Failed to update task')
        }
    }

    return (
        <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
                <TaskItem
                    key={task.id}
                    task={task}
                    onToggle={() => handleToggle(task.id)}
                />
            ))}
        </ul>
    )
}
```

Two related simplifications fall out naturally:
- `handleToggle` loses its `willBeCompleted` parameter — it was only used to pick the toast text.
- `onToggle={() => handleToggle(task.id, !task.isCompleted)}` becomes `onToggle={() => handleToggle(task.id)}`.

- [ ] **Step 2: Verify in the browser**

```bash
npm run dev
```

At `/tasks`, click a checkbox a few times. **No toast appears** on the toggle. The checkbox still flips. The active/completed counters update. Adding a task still shows "Task added"; clicking "Delete completed" still shows the count toast.

(Optional) To confirm the error toast still works, briefly stop the backend (`Ctrl-C` in the server terminal), click a checkbox, and you should see "Failed to update task". Restart the server when done.

- [ ] **Step 3: Commit**

```bash
git add src/features/todo/components/TaskList/TaskList.tsx
git commit -m "Drop toggle success toast (keep error)"
```

---

## Task 13: Add the Sidebar pending-count badge

**Files:**
- Modify: `src/layout/Sidebar/Sidebar.tsx`

- [ ] **Step 1: Update the Sidebar**

```tsx
import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/routes'
import { cn } from '@/lib/utils'
import { useTodoStore } from '@/features/todo'

type SidebarProps = {
    isOpen: boolean
}

const NAV_ITEMS = [
    { to: ROUTES.counters, label: 'Counters' },
    { to: ROUTES.ticTacToe, label: 'Tic-Tac-Toe' },
    { to: ROUTES.todo, label: 'Todo' },
] as const

export default function Sidebar({ isOpen }: SidebarProps) {
    // Subscribe to the active count only. This selector returns a number — a
    // primitive — so Zustand's default Object.is comparison naturally gives us
    // "re-render only when the count actually changes" semantics. Toggling a
    // task on any other page bumps this immediately.
    const activeCount = useTodoStore((s) => s.tasks.filter((t) => !t.isCompleted).length)

    return (
        <aside
            className={cn(
                'bg-sidebar text-sidebar-foreground overflow-hidden border-r transition-[width] duration-300 ease-out',
                isOpen ? 'w-60' : 'w-0 border-r-0',
            )}
            aria-hidden={!isOpen}
        >
            <div className="flex w-60 flex-col gap-6 p-4">
                <h2 className="text-primary px-2 text-xs font-semibold tracking-[0.2em] uppercase">
                    React Intro
                </h2>
                <nav className="flex flex-col gap-1">
                    {NAV_ITEMS.map((item) => (
                        <NavLink
                            key={item.to}
                            to={item.to}
                            className={({ isActive }) =>
                                cn(
                                    'flex items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'bg-sidebar-accent text-foreground'
                                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
                                )
                            }
                        >
                            <span className="flex-1">{item.label}</span>
                            {item.to === ROUTES.todo && activeCount > 0 && (
                                <span
                                    key={activeCount}
                                    aria-label={`${activeCount} active tasks`}
                                    className="bg-primary text-primary-foreground animate-pop inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums"
                                >
                                    {activeCount}
                                </span>
                            )}
                        </NavLink>
                    ))}
                </nav>
            </div>
        </aside>
    )
}
```

**Three details to internalize:**

1. **`useTodoStore((s) => s.tasks.filter(...).length)`** returns a number. Numbers are compared with `Object.is`, so Zustand only re-renders Sidebar when this specific number changes. Editing the Todo search input? Adding a console.log? Sidebar stays untouched.

2. **`key={activeCount}` on the badge** — React unmounts and re-mounts the element whenever the key changes, which re-triggers the `animate-pop` entrance animation (one of the motion tokens we added in the Tailwind polish work). Three characters of code for free "the number popped, look at me" feedback.

3. **Hidden when `activeCount === 0`** — a "0" pill reads as visual noise. The badge being absent is the correct "everything done" state.

- [ ] **Step 2: Manual verification**

```bash
npm run dev
```

- Navigate to `/tasks`. Add a task. The "Todo" link in the sidebar gains a `1` pill.
- Navigate to `/counters` (Todo page unmounted). The pill stays visible.
- Open `/counters` in a side panel mentally, but actually: stay on `/counters`. Now there's no UI to toggle the task from. *That's the point* — the badge would still update if you toggled the task via the API directly. To prove the live update, instead: navigate back to `/tasks`, check a task. **Watch the sidebar pill update instantly** as the checkbox flips, without re-rendering anything else.

- [ ] **Step 3: Commit**

```bash
git add src/layout/Sidebar/Sidebar.tsx
git commit -m "Add real-time pending-task badge to Sidebar"
```

---

## Task 14: Delete the obsolete useTasks hook

**Files:**
- Delete: `src/features/todo/hooks/useTasks.ts`
- Delete: `src/features/todo/hooks/` directory (now empty)

- [ ] **Step 1: Confirm nothing imports useTasks anymore**

```bash
grep -rn "useTasks" src/ e2e/
```

Expected: zero matches. (If you see any, you missed a consumer — go back and refactor that file before deleting.)

- [ ] **Step 2: Delete the file and the empty directory**

```bash
rm src/features/todo/hooks/useTasks.ts
rmdir src/features/todo/hooks
```

- [ ] **Step 3: Run /check (lint + typecheck + unit tests)**

```bash
npm run lint && npx tsc -b && npm run test:run
```

Expected: all green. If anything fails, fix it before committing.

- [ ] **Step 4: Commit**

```bash
git add -A src/features/todo/hooks
git commit -m "Remove useTasks hook (replaced by todoStore)"
```

---

## Task 15: E2E test — cache on navigation (the assignment requirement)

**Files:**
- Create: `e2e/todo-global-state.spec.ts`

- [ ] **Step 1: Write the spec**

```ts
import { test, expect } from '@playwright/test'

// The literal-spec encoding of "avoid redundant recurring loadings from the
// server when moving between different pages." If this test passes, the
// assignment's smart-reloading requirement is met.

test('navigating away from /tasks and back does not refetch GET /tasks', async ({ page }) => {
    const getTasksRequests: string[] = []
    page.on('request', (req) => {
        if (req.url().includes('/tasks') && req.method() === 'GET') {
            getTasksRequests.push(req.url())
        }
    })

    // First visit — the Provider's init() effect fires the one and only GET /tasks.
    await page.goto('/tasks')
    await expect(page.getByText('Loading tasks…')).toBeHidden()

    // Navigate away. The Provider stays mounted because Layout (and the Provider
    // above it) is not part of the page route — only the route content unmounts.
    await page.getByRole('link', { name: 'Tic-Tac-Toe' }).click()
    await expect(page).toHaveURL(/tic-tac-toe$/)

    // Navigate back. Tasks should appear immediately, with no loader visible.
    await page.getByRole('link', { name: 'Todo' }).click()
    await expect(page).toHaveURL(/tasks$/)
    await expect(page.getByText('Loading tasks…')).toBeHidden()

    // The whole point: exactly one network request to GET /tasks, ever.
    expect(getTasksRequests).toHaveLength(1)
})

test('Sidebar badge updates in real time as a task is toggled', async ({ page }) => {
    await page.goto('/tasks')
    await expect(page.getByText('Loading tasks…')).toBeHidden()

    // Use a unique title so reruns don't collide with leftover tasks from
    // previous runs (this app's UI has no per-task delete to clean up after).
    const title = `Badge test ${Date.now()}`

    await page.getByRole('textbox', { name: 'New task' }).fill(title)
    await page.getByRole('button', { name: 'Add' }).click()

    // The Todo nav link exposes a pill with aria-label like "3 active tasks".
    const badge = page.getByLabel(/\d+ active tasks?/)
    await expect(badge).toBeVisible()

    // We can't assume the exact starting count because previous runs may have
    // left tasks on the server — assert relative motion instead.
    const beforeText = await badge.textContent()
    const before = Number(beforeText)

    // Toggle the new task to completed → active count drops by 1.
    const checkbox = page
        .getByRole('listitem')
        .filter({ hasText: title })
        .getByRole('checkbox')
    await checkbox.check()

    if (before === 1) {
        // Going to zero — badge should disappear entirely.
        await expect(badge).toBeHidden()
    } else {
        await expect(badge).toHaveText(String(before - 1))
    }

    // Toggle back to active and verify the badge climbs again — proves the
    // selector is reactive in both directions.
    await checkbox.uncheck()
    await expect(badge).toHaveText(String(before))
})
```

**About cumulative task leakage across test runs:** this app's Todo page only has a bulk "Delete completed" action, not per-task delete in the UI. The timestamped title keeps each run's task uniquely identifiable, so reruns don't collide — but the server DB accumulates leftover active tasks. For a learning project that's harmless. If it becomes annoying, hit the backend's `DELETE /tasks/:id` via `page.request.delete(...)` in an `afterEach` hook.

- [ ] **Step 2: Start the dev server (if not running) and the backend**

The E2E suite needs the Express backend running for `/tasks` endpoints. From the `../server` directory:

```bash
cd ../server && npm run dev
```

Leave it running in another terminal.

- [ ] **Step 3: Run the new spec**

```bash
npm run test:e2e -- e2e/todo-global-state.spec.ts
```

Expected: both tests PASS.

- [ ] **Step 4: Commit**

```bash
git add e2e/todo-global-state.spec.ts
git commit -m "Add E2E tests for cache-on-navigation and live sidebar badge"
```

---

## Task 16: Final check + push the branch + open PR

- [ ] **Step 1: Full project check**

```bash
npm run lint && npx tsc -b && npm run test:run && npm run format:check
```

Expected: all green. Fix any lint/format violations before pushing (Prettier owns formatting, so `npm run format` will auto-fix most issues).

- [ ] **Step 2: E2E check (with both servers running)**

```bash
npm run test:e2e
```

Expected: all tests PASS, including the existing `counter.spec.ts` and the new `todo-global-state.spec.ts`.

- [ ] **Step 3: Push the branch**

```bash
git push -u origin feature/todo-global-state
```

- [ ] **Step 4: Open the PR**

```bash
gh pr create --title "Global state for Todo via Zustand factory + Provider" --body-file - <<'EOF'
## Summary

Migrates the Todo feature from per-component local state to a single global Zustand store, eliminating redundant server fetches on navigation and surfacing a live pending-task count badge in the Sidebar.

## Architecture

- **Pattern:** Zustand "store factory + React Context Provider" (the docs-recommended SSR-safe shape).
  - `createTodoStore()` — vanilla store factory; no React, no side effects at construction.
  - `<TodoStoreProvider>` — instantiates one store via `useState(() => createTodoStore())` (React 19 idiom — `useRef` trips `react-hooks/refs`), fires `init()` in `useEffect` (idempotent, StrictMode-safe).
  - `useTodoStore(selector)` — selector hook with narrow re-render semantics.
  - `useTodoActions()` — wrapped in `useShallow` for stable action references.
- **Lifecycle:** 4-state `status` enum (`idle | loading | ready | error`). Mutations after `ready` don't transition back to `loading` — that's what delivers "no spinner on cache hits."
- **Server-authoritative state:** actions await the server, then update from the returned object. Same pessimistic pattern as before.

## Why "Context + Zustand" and not module-singleton Zustand

The assignment specifies wrapping the app in a Provider. The factory+Provider pattern matches that language literally, and is also Zustand's own recommendation for app-router/SSR contexts. Costs ~15 lines of boilerplate; buys clean test isolation (fresh store per `<Provider>` mount) and the right shape for the assignment.

## Files

- New: `src/features/todo/store/{todoStore,todoStoreContext,TodoStoreProvider,useTodoStore}.{ts,tsx}` + tests
- Modified: `App.tsx`, `TodoPage.tsx`, `TaskStats.tsx`, `AddTaskForm.tsx`, `TaskList.tsx`, `TaskItem.tsx`, `Sidebar.tsx`, `features/todo/index.ts`, `playwright.config.ts`
- Deleted: `src/features/todo/hooks/useTasks.ts`
- New E2E: `e2e/todo-global-state.spec.ts` (one test asserts `GET /tasks` fires exactly once across navigation; one asserts the Sidebar badge updates live)

## Verified behaviors

- First load of `/tasks` shows the spinner, then the task list. `GET /tasks` fires once.
- Navigating `/tasks` → `/tic-tac-toe` → `/tasks` shows no spinner the second time; zero additional `GET /tasks` requests.
- Adding / toggling / deleting tasks updates the Sidebar badge instantly from any page.
- Unit tests cover all store actions including init idempotency.
EOF
```

- [ ] **Step 5: Confirm the PR URL is returned and merge per Nadav's normal flow**

(Per project convention, Nadav merges PRs himself.)

---

## Best practices applied (recap)

| Practice | Where it lives in this plan |
|---|---|
| Narrow selectors → minimal re-renders | Tasks 8, 10, 13 (every consumer subscribes to the smallest slice) |
| `useShallow` for object-returning selectors | Task 5 (`useTodoActions()`) |
| Idempotent init guarded by status enum | Task 2 (`if (get().status !== 'idle') return`) |
| `useState(() => createX())` for component-lifetime singletons (React 19) | Task 4 |
| Side effects out of the factory body | Tasks 2 + 4 (factory is pure; `init()` runs in Provider's effect) |
| Stable action references via store creation | Task 2 (actions defined once in `createStore`) |
| Status enum vs boolean loading (no spinner on cache hits) | Tasks 2, 8 |
| Server-authoritative state (no optimistic guess) | Task 2 (mutations use server's returned object) |
| Cross-feature import via `index.ts` | Tasks 6 + 13 (Sidebar imports `from '@/features/todo'`) |
| TDD where the unit is testable in isolation | Tasks 3 (store) + 5 (hook) |
| Manual + E2E verification of the user-visible outcome | Tasks 11, 13 (manual smoke) + 15 (E2E spec) |
