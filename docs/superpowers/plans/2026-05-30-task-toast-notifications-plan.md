# Task Toast Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Display ephemeral success/error toast notifications when the user creates, toggles, or deletes a task, surfacing API mutation outcomes without disrupting existing UI flows.

**Architecture:** Mount a single shadcn-generated `<Toaster />` from `sonner` at the app root (inside `App.tsx`) so any descendant component can fire `toast()`. Wire the actual `toast.success` / `toast.error` calls into the existing mutation functions in `useTasks.ts` (`addTask`, `toggleTask`, `deleteCompleted`) — happy path triggers `toast.success`, catch block triggers `toast.error` (alongside the existing `console.error`). Test the hook in isolation with vitest + `@testing-library/react`, mocking both `sonner` and the API layer.

**Tech Stack:** sonner, shadcn CLI, vitest, @testing-library/react.

---

## File Structure

**Files to be created:**
- `src/components/ui/sonner.tsx` — shadcn-generated Toaster wrapper. Owns the Toaster's theme and default props.
- `src/features/todo/hooks/useTasks.test.ts` — vitest tests for the three mutations (`addTask`, `toggleTask`, `deleteCompleted`), each covering success + error paths.

**Files to be modified:**
- `src/App.tsx` — mount `<Toaster />` once inside `<BrowserRouter>`.
- `src/features/todo/hooks/useTasks.ts` — add `toast.success` after successful mutations, `toast.error` in catch blocks.
- `package.json` / `package-lock.json` — add `sonner` dependency.
- `components.json` — may be updated by `npx shadcn add sonner`.

---

## Task 1: Install sonner

**Files:**
- Modify: `package.json`, `package-lock.json`

- [ ] **Step 1: Install the runtime dependency**

```bash
npm install sonner
```

- [ ] **Step 2: Verify the package landed in dependencies**

Run: `grep sonner package.json`
Expected: a line like `"sonner": "^1.x.x",` under `"dependencies"`.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add sonner for toast notifications"
```

---

## Task 2: Generate the shadcn Toaster wrapper

**Files:**
- Create: `src/components/ui/sonner.tsx`
- Modify: `components.json` (potentially)

- [ ] **Step 1: Run the shadcn CLI**

```bash
npx shadcn@latest add sonner
```

Expected output: prompts may appear; accept defaults. The CLI creates `src/components/ui/sonner.tsx` and prints "Done."

- [ ] **Step 2: Confirm the file exists and exports Toaster**

Run: `grep "export.*Toaster" src/components/ui/sonner.tsx`
Expected: a line containing `export { Toaster }` (or equivalent).

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/sonner.tsx components.json
git commit -m "feat: scaffold shadcn sonner Toaster component"
```

---

## Task 3: Mount the Toaster in App.tsx

**Files:**
- Modify: `src/App.tsx`

- [ ] **Step 1: Update App.tsx to render the Toaster**

Replace the entire file with:

```tsx
import { BrowserRouter } from 'react-router-dom'
import AppRoutes from './AppRoutes'
import { Toaster } from '@/components/ui/sonner'

export default function App() {
    return (
        <BrowserRouter>
            <AppRoutes />
            <Toaster richColors position="top-right" />
        </BrowserRouter>
    )
}
```

**WHY `richColors`:** without it, sonner toasts are uniform-colored. With it, `toast.success` is green and `toast.error` is red — visual distinction with zero extra config.

**WHY `position="top-right"`:** chosen so toasts don't overlap with the existing AddTaskForm / TaskList in the page body. Any of the four corners works; pick whichever doesn't collide with frequently-used UI.

- [ ] **Step 2: Verify the Toaster mounts without errors**

Run: `npm run dev`
Open the app. Expected: page renders normally. In the browser DevTools console, run:

```js
import('sonner').then(({ toast }) => toast.success('Hello'))
```

Expected: a green "Hello" toast appears top-right and fades out after a few seconds.

- [ ] **Step 3: Commit**

```bash
git add src/App.tsx
git commit -m "feat: mount sonner Toaster at app root"
```

---

## Task 4: Scaffold the useTasks test file

**Files:**
- Create: `src/features/todo/hooks/useTasks.test.ts`

- [ ] **Step 1: Create the test file with mocks and a smoke test**

Create `src/features/todo/hooks/useTasks.test.ts` with this content:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { toast } from 'sonner'
import { useTasks } from './useTasks'
import * as tasksApi from '../api/tasksApi'

vi.mock('sonner', () => ({
    toast: {
        success: vi.fn(),
        error: vi.fn(),
    },
}))

vi.mock('../api/tasksApi', () => ({
    fetchTasks: vi.fn(),
    createTask: vi.fn(),
    updateTask: vi.fn(),
    deleteTask: vi.fn(),
}))

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(tasksApi.fetchTasks).mockResolvedValue([])
})

describe('useTasks', () => {
    it('finishes initial load without toasting', async () => {
        const { result } = renderHook(() => useTasks())
        await waitFor(() => expect(result.current.loading).toBe(false))
        expect(toast.success).not.toHaveBeenCalled()
        expect(toast.error).not.toHaveBeenCalled()
    })
})
```

**WHY mock `sonner`:** the actual `toast()` calls would try to render into a Toaster that doesn't exist in jsdom. Mocking lets us assert "the right call was made" without rendering anything.

**WHY mock the API layer:** `tasksApi` calls real `axios` against a real server. Tests should not depend on a running backend.

**WHY `vi.clearAllMocks()` in `beforeEach`:** prevents state leakage between tests — a `toast.success` called in test 1 would otherwise show up as already-called in test 2.

- [ ] **Step 2: Run the test to confirm it passes**

Run: `npm run test:run -- src/features/todo/hooks/useTasks.test.ts`
Expected: 1 test passes — `useTasks > finishes initial load without toasting`.

- [ ] **Step 3: Commit**

```bash
git add src/features/todo/hooks/useTasks.test.ts
git commit -m "test: scaffold useTasks test file with sonner + api mocks"
```

---

## Task 5: Add toasts to addTask (TDD)

**Files:**
- Modify: `src/features/todo/hooks/useTasks.test.ts`
- Modify: `src/features/todo/hooks/useTasks.ts:25-34`

- [ ] **Step 1: Write the failing tests**

Append to the `describe('useTasks', ...)` block in `useTasks.test.ts`:

```ts
    describe('addTask', () => {
        it('toasts success when the task is created', async () => {
            vi.mocked(tasksApi.createTask).mockResolvedValue({
                id: '1',
                title: 'buy milk',
                isCompleted: false,
            })
            const { result } = renderHook(() => useTasks())
            await waitFor(() => expect(result.current.loading).toBe(false))

            await result.current.addTask('buy milk')

            expect(toast.success).toHaveBeenCalledWith('Task added')
            expect(toast.error).not.toHaveBeenCalled()
        })

        it('toasts an error when creation fails', async () => {
            vi.mocked(tasksApi.createTask).mockRejectedValue(new Error('boom'))
            const { result } = renderHook(() => useTasks())
            await waitFor(() => expect(result.current.loading).toBe(false))

            await result.current.addTask('buy milk')

            expect(toast.error).toHaveBeenCalledWith('Failed to add task')
            expect(toast.success).not.toHaveBeenCalled()
        })

        it('does nothing on empty input', async () => {
            const { result } = renderHook(() => useTasks())
            await waitFor(() => expect(result.current.loading).toBe(false))

            await result.current.addTask('   ')

            expect(tasksApi.createTask).not.toHaveBeenCalled()
            expect(toast.success).not.toHaveBeenCalled()
            expect(toast.error).not.toHaveBeenCalled()
        })
    })
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm run test:run -- src/features/todo/hooks/useTasks.test.ts`
Expected: the two "toasts ..." tests fail (toast was not called). The "does nothing on empty input" test passes (current behavior already handles this).

- [ ] **Step 3: Implement the toast calls in addTask**

In `src/features/todo/hooks/useTasks.ts`, add the `sonner` import near the top:

```ts
import { toast } from 'sonner'
```

Then replace the `addTask` function (lines 25-34) with:

```ts
    async function addTask(title: string) {
        const trimmed = title.trim()
        if (trimmed === '') return
        try {
            const created = await createTask(trimmed)
            setTasks((prev) => [...prev, created])
            toast.success('Task added')
        } catch (err) {
            console.error('Failed to add task', err)
            toast.error('Failed to add task')
        }
    }
```

**WHY keep `console.error` alongside `toast.error`:** toast is for the user (ephemeral, vanishes); console.error is for the developer (inspectable in DevTools while debugging).

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm run test:run -- src/features/todo/hooks/useTasks.test.ts`
Expected: all four tests pass (1 smoke + 3 addTask).

- [ ] **Step 5: Commit**

```bash
git add src/features/todo/hooks/useTasks.ts src/features/todo/hooks/useTasks.test.ts
git commit -m "feat: toast success/error on addTask"
```

---

## Task 6: Add toasts to toggleTask (TDD)

**Files:**
- Modify: `src/features/todo/hooks/useTasks.test.ts`
- Modify: `src/features/todo/hooks/useTasks.ts:36-45`

- [ ] **Step 1: Make the test default-mock fetchTasks return one task**

To exercise `toggleTask`, the initial state must contain a task. Update the `beforeEach` in `useTasks.test.ts` so that for this section we can seed tasks. Replace the current `beforeEach` with a helper:

```ts
const seedTask = (overrides: Partial<{ id: string; title: string; isCompleted: boolean }> = {}) => ({
    id: '1',
    title: 'buy milk',
    isCompleted: false,
    ...overrides,
})

beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(tasksApi.fetchTasks).mockResolvedValue([])
})
```

(Just adds `seedTask` helper at top of file — `beforeEach` body unchanged.)

- [ ] **Step 2: Write the failing tests**

Append to the `describe('useTasks', ...)` block:

```ts
    describe('toggleTask', () => {
        it('toasts "Task completed" when toggling an active task to completed', async () => {
            const task = seedTask({ isCompleted: false })
            vi.mocked(tasksApi.fetchTasks).mockResolvedValue([task])
            vi.mocked(tasksApi.updateTask).mockResolvedValue({ ...task, isCompleted: true })
            const { result } = renderHook(() => useTasks())
            await waitFor(() => expect(result.current.loading).toBe(false))

            await result.current.toggleTask('1')

            expect(toast.success).toHaveBeenCalledWith('Task completed')
        })

        it('toasts "Task marked active" when toggling a completed task back', async () => {
            const task = seedTask({ isCompleted: true })
            vi.mocked(tasksApi.fetchTasks).mockResolvedValue([task])
            vi.mocked(tasksApi.updateTask).mockResolvedValue({ ...task, isCompleted: false })
            const { result } = renderHook(() => useTasks())
            await waitFor(() => expect(result.current.loading).toBe(false))

            await result.current.toggleTask('1')

            expect(toast.success).toHaveBeenCalledWith('Task marked active')
        })

        it('toasts an error when the update fails', async () => {
            const task = seedTask({ isCompleted: false })
            vi.mocked(tasksApi.fetchTasks).mockResolvedValue([task])
            vi.mocked(tasksApi.updateTask).mockRejectedValue(new Error('boom'))
            const { result } = renderHook(() => useTasks())
            await waitFor(() => expect(result.current.loading).toBe(false))

            await result.current.toggleTask('1')

            expect(toast.error).toHaveBeenCalledWith('Failed to update task')
            expect(toast.success).not.toHaveBeenCalled()
        })
    })
```

- [ ] **Step 3: Run the tests and confirm they fail**

Run: `npm run test:run -- src/features/todo/hooks/useTasks.test.ts`
Expected: the three new `toggleTask` tests fail.

- [ ] **Step 4: Implement the toast calls in toggleTask**

In `src/features/todo/hooks/useTasks.ts`, replace the `toggleTask` function with:

```ts
    async function toggleTask(id: string) {
        const task = tasks.find((t) => t.id === id)
        if (!task) return
        try {
            const updated = await updateTask(id, { isCompleted: !task.isCompleted })
            setTasks((prev) => prev.map((t) => (t.id === id ? updated : t)))
            toast.success(updated.isCompleted ? 'Task completed' : 'Task marked active')
        } catch (err) {
            console.error('Failed to toggle task', err)
            toast.error('Failed to update task')
        }
    }
```

**WHY the dynamic message:** "Task completed" vs "Task marked active" is more informative than a generic "Task updated." The branch is one ternary; well worth the clarity.

- [ ] **Step 5: Run the tests and confirm they pass**

Run: `npm run test:run -- src/features/todo/hooks/useTasks.test.ts`
Expected: all tests pass (now 7 total).

- [ ] **Step 6: Commit**

```bash
git add src/features/todo/hooks/useTasks.ts src/features/todo/hooks/useTasks.test.ts
git commit -m "feat: toast success/error on toggleTask"
```

---

## Task 7: Add toasts to deleteCompleted (TDD)

**Files:**
- Modify: `src/features/todo/hooks/useTasks.test.ts`
- Modify: `src/features/todo/hooks/useTasks.ts:47-56`

- [ ] **Step 1: Write the failing tests**

Append to the `describe('useTasks', ...)` block:

```ts
    describe('deleteCompleted', () => {
        it('toasts the singular form when one task is deleted', async () => {
            vi.mocked(tasksApi.fetchTasks).mockResolvedValue([seedTask({ id: '1', isCompleted: true })])
            vi.mocked(tasksApi.deleteTask).mockResolvedValue(undefined)
            const { result } = renderHook(() => useTasks())
            await waitFor(() => expect(result.current.loading).toBe(false))

            await result.current.deleteCompleted()

            expect(toast.success).toHaveBeenCalledWith('Deleted 1 task')
        })

        it('toasts the plural form when multiple tasks are deleted', async () => {
            vi.mocked(tasksApi.fetchTasks).mockResolvedValue([
                seedTask({ id: '1', isCompleted: true }),
                seedTask({ id: '2', isCompleted: true }),
                seedTask({ id: '3', isCompleted: false }),
            ])
            vi.mocked(tasksApi.deleteTask).mockResolvedValue(undefined)
            const { result } = renderHook(() => useTasks())
            await waitFor(() => expect(result.current.loading).toBe(false))

            await result.current.deleteCompleted()

            expect(toast.success).toHaveBeenCalledWith('Deleted 2 tasks')
        })

        it('toasts an error when any delete fails', async () => {
            vi.mocked(tasksApi.fetchTasks).mockResolvedValue([seedTask({ id: '1', isCompleted: true })])
            vi.mocked(tasksApi.deleteTask).mockRejectedValue(new Error('boom'))
            const { result } = renderHook(() => useTasks())
            await waitFor(() => expect(result.current.loading).toBe(false))

            await result.current.deleteCompleted()

            expect(toast.error).toHaveBeenCalledWith('Failed to delete tasks')
            expect(toast.success).not.toHaveBeenCalled()
        })
    })
```

- [ ] **Step 2: Run the tests and confirm they fail**

Run: `npm run test:run -- src/features/todo/hooks/useTasks.test.ts`
Expected: the three new `deleteCompleted` tests fail.

- [ ] **Step 3: Implement the toast calls in deleteCompleted**

In `src/features/todo/hooks/useTasks.ts`, replace the `deleteCompleted` function with:

```ts
    async function deleteCompleted() {
        const completedTasks = tasks.filter((t) => t.isCompleted)
        try {
            await Promise.all(completedTasks.map((t) => deleteTask(t.id)))
            setTasks((prev) => prev.filter((t) => !t.isCompleted))
            const n = completedTasks.length
            toast.success(`Deleted ${n} task${n === 1 ? '' : 's'}`)
        } catch (err) {
            console.error('Failed to delete task', err)
            toast.error('Failed to delete tasks')
        }
    }
```

**WHY pluralize manually:** `Deleted 1 task` vs `Deleted 3 tasks` reads naturally. The ternary is one line and worth it.

- [ ] **Step 4: Run the tests and confirm they pass**

Run: `npm run test:run -- src/features/todo/hooks/useTasks.test.ts`
Expected: all tests pass (now 10 total: 1 smoke + 3 addTask + 3 toggleTask + 3 deleteCompleted).

- [ ] **Step 5: Commit**

```bash
git add src/features/todo/hooks/useTasks.ts src/features/todo/hooks/useTasks.test.ts
git commit -m "feat: toast success/error on deleteCompleted"
```

---

## Task 8: Manual end-to-end verification

**Files:** none

- [ ] **Step 1: Start the app**

```bash
npm run dev
```

- [ ] **Step 2: Verify success toasts (with the API server running)**

1. Navigate to `/tasks` (or whatever `ROUTES.todo` resolves to).
2. Add a task — expect a green "Task added" toast top-right.
3. Click the checkbox on an active task — expect "Task completed".
4. Click the checkbox on a completed task — expect "Task marked active".
5. Click "Delete completed" with one completed task — expect "Deleted 1 task".
6. Add 3 tasks, complete 2, click "Delete completed" — expect "Deleted 2 tasks".

- [ ] **Step 3: Verify error toasts**

In DevTools → Network → toggle "Offline":

1. Try adding a task — expect a red "Failed to add task" toast.
2. Try toggling a task — expect "Failed to update task".
3. Try deleting completed — expect "Failed to delete tasks".

Turn Network back online when done.

- [ ] **Step 4: Final smoke test**

Run the full test suite to confirm nothing else regressed:

```bash
npm run test:run
```

Expected: all tests pass (existing + the 10 new ones).

- [ ] **Step 5: Final commit (if any cleanup was needed)**

If any cleanup edits were made during manual verification:

```bash
git add -A
git commit -m "chore: cleanup after toast notification verification"
```

Otherwise, this task has no commit.

---

## Self-Review

**Spec coverage:**
- ✅ Toast on create — Task 5
- ✅ Toast on update (toggle) — Task 6
- ✅ Toast on delete — Task 7
- ✅ Distinguishes success vs error — Tasks 5/6/7 cover both paths with separate tests

**Placeholder scan:** no TBDs, no "handle edge cases", no "similar to Task N" — all code is spelled out.

**Type consistency:**
- `toast.success` / `toast.error` API used identically in all tasks.
- `seedTask` helper introduced in Task 6 is used in Tasks 6 and 7 (single shape, no drift).
- Mutation signatures (`addTask`, `toggleTask`, `deleteCompleted`) match what's in `useTasks.ts` today — verified against `useTasks.ts:25-56`.
