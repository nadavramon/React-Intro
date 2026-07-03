# Todo Search Debounce Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Execution is owned by `/implement` — do not re-offer execution-mode choices at the end.

**Goal:** Debounce the Todo SearchBar filter (~300ms) via a reusable `useDebouncedValue<T>` hook in `src/hooks/`, backed by `lodash.debounce`. Input stays instant; only the derived filter waits.

**Architecture:** A generic `useDebouncedValue(value, delay)` hook captures the debounced setter once via `useMemo`, calls it from a `useEffect` keyed on `[value, update]`, and `.cancel()`s the pending timer on cleanup. `TodoPage` consumes it: raw `searchQuery` stays bound to the input; `debouncedQuery` drives both `filteredTasks` and the empty-state message. `SearchBar` is unchanged.

**Tech Stack:** React 19, TypeScript (strict), Vitest (fake timers), `lodash.debounce` 4.0.8, `@testing-library/react` 16.

**Reference spec:** [docs/superpowers/specs/2026-06-24-todo-search-debounce-design.md](../specs/2026-06-24-todo-search-debounce-design.md)

> **Status note (refined 2026-06-24).** The tanstack-router work this plan originally worked around is now **merged to `main`**, so the separate-worktree machinery is dropped — this runs as a normal branch off a clean `main`. Task 2's lockfile check is upgraded from "eyeball the diff" to the strict `npm ci` validation (the exact drift that bit the tanstack PR), per the pipeline's verify-mirrors-CI discipline.

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| `package.json` / `package-lock.json` | Modify (in the debounce worktree) | Add `lodash.debounce` (dep) + `@types/lodash.debounce` (devDep). |
| `src/hooks/useDebouncedValue.ts` | Create | Generic `<T>` hook. `useMemo`-stable debounced setter; cancel on cleanup. |
| `src/hooks/useDebouncedValue.test.ts` | Create | 3 vitest assertions with fake timers (initial / delayed / coalesced). |
| `src/features/todo/TodoPage.tsx` | Modify | Derive `debouncedQuery`; use it in `filteredTasks` and the empty-state message. |

`src/hooks/` already exists as an empty untracked directory in the main checkout — it'll come through to the new worktree as the same empty dir. `SearchBar.tsx` unchanged.

---

### Task 1: Branch off main

**Files:** none — sets up the working branch.

- [ ] **Step 1: Sync main and cut the branch**

```bash
git checkout main && git pull origin main
git checkout -b feat/debounce-search
```

Expected: a clean `feat/debounce-search` off the latest `main` (which now includes the merged TanStack Router work).

- [ ] **Step 2: Baseline smoke**

```bash
npm run lint && npm run build && npm run test:run
```

Expected: lint clean, `tsc -b && vite build` clean, 20/20 unit tests pass — the baseline before any debounce edits.

---

### Task 2: Install lodash.debounce + types

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Install runtime dep**

```bash
npm install lodash.debounce
```

Expected: `package.json` gains `"lodash.debounce": "^4.0.8"` under `dependencies`. `package-lock.json` updates.

- [ ] **Step 2: Install types**

```bash
npm install -D @types/lodash.debounce
```

Expected: `package.json` gains `"@types/lodash.debounce": "^4.0.x"` under `devDependencies`.

- [ ] **Step 3: Validate the lockfile is in sync (catches drift before CI)**

```bash
npm ci
```

Expected: clean install, exit 0. `npm install` tolerates lockfile drift; CI runs the strict `npm ci`, which fails if optional peers like `@emnapi/*` got dropped — the exact failure that bit the tanstack PR. If `npm ci` errors with `Missing: @emnapi/... from lock file`, do a **full clean regen**: `rm -rf node_modules package-lock.json && npm install`, then re-run `npm ci` to confirm. (A *partial* regen — lockfile only — drops `@emnapi` on macOS and makes it worse.) See [memory: npm lockfile drift](../../../.claude/projects/-Users-nadavramon-fullstack-projects-React-Intro/memory/feedback_npm_lockfile_drift.md).

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add lodash.debounce + @types/lodash.debounce"
```

---

### Task 3: Write the hook test-first, then the hook (TDD)

**Files:**
- Create: `src/hooks/useDebouncedValue.test.ts`
- Create: `src/hooks/useDebouncedValue.ts`

- [ ] **Step 1: Write the failing test file**

Create `src/hooks/useDebouncedValue.test.ts`:

```ts
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDebouncedValue } from './useDebouncedValue'

describe('useDebouncedValue', () => {
    beforeEach(() => vi.useFakeTimers())
    afterEach(() => vi.useRealTimers())

    it('returns the initial value immediately', () => {
        const { result } = renderHook(() => useDebouncedValue('a', 300))
        expect(result.current).toBe('a')
    })

    it('updates only after the delay elapses', () => {
        const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
            initialProps: { v: 'a' },
        })
        rerender({ v: 'b' })
        expect(result.current).toBe('a')
        act(() => {
            vi.advanceTimersByTime(300)
        })
        expect(result.current).toBe('b')
    })

    it('coalesces rapid changes — only the latest value fires', () => {
        const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
            initialProps: { v: 'a' },
        })
        rerender({ v: 'b' })
        act(() => {
            vi.advanceTimersByTime(100)
        })
        rerender({ v: 'c' })
        act(() => {
            vi.advanceTimersByTime(300)
        })
        expect(result.current).toBe('c')
    })
})
```

- [ ] **Step 2: Run the test, confirm it fails**

```bash
npm run test:run -- useDebouncedValue
```

Expected: 3 failures with `Cannot find module './useDebouncedValue'`.

- [ ] **Step 3: Write the hook**

Create `src/hooks/useDebouncedValue.ts`:

```ts
// NOTE: lodash.debounce is frozen-but-stable. A future migration could
// swap to es-toolkit's debounce or a hand-rolled setTimeout with no API change.
import { useEffect, useMemo, useState } from 'react'
import debounce from 'lodash.debounce'

export function useDebouncedValue<T>(value: T, delay = 300): T {
    const [debounced, setDebounced] = useState(value)

    // Stable debounced setter — memoized so the SAME timer instance
    // coalesces consecutive calls. Recreated only if delay changes.
    const update = useMemo(
        () => debounce((next: T) => setDebounced(next), delay),
        [delay],
    )

    useEffect(() => {
        update(value)
        return () => update.cancel()
    }, [value, update])

    return debounced
}
```

- [ ] **Step 4: Re-run the test, confirm all 3 pass**

```bash
npm run test:run -- useDebouncedValue
```

Expected: `Tests  3 passed (3)`. PostToolUse `tsc` hook confirms types clean.

- [ ] **Step 5: Commit (TDD cycle as one commit)**

```bash
git add src/hooks/useDebouncedValue.ts src/hooks/useDebouncedValue.test.ts
git commit -m "feat(hooks): add useDebouncedValue<T> hook with fake-timer tests"
```

---

### Task 4: Wire TodoPage to use the debounced value

**Files:**
- Modify: `src/features/todo/TodoPage.tsx`

- [ ] **Step 1: Add the hook import and derive `debouncedQuery`**

In [src/features/todo/TodoPage.tsx](../../../src/features/todo/TodoPage.tsx), at the top of the imports block, add:

```tsx
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
```

Inside the component, immediately after the `useState('')` line, add:

```tsx
const debouncedQuery = useDebouncedValue(searchQuery, 300)
```

So the relevant block reads:

```tsx
const [searchQuery, setSearchQuery] = useState('')
const debouncedQuery = useDebouncedValue(searchQuery, 300)

const filteredTasks = useMemo(
    () => tasks.filter((task) => task.title.toLowerCase().includes(debouncedQuery.toLowerCase())),
    [tasks, debouncedQuery],
)
```

Both edits matter: `searchQuery` → `debouncedQuery` inside the filter, AND the dependency array updates to `[tasks, debouncedQuery]`.

- [ ] **Step 2: Update the empty-state message to read the debounced value**

In the same file, swap the template literal:

```tsx
// Before:
: `No tasks match "${searchQuery}".`}

// After:
: `No tasks match "${debouncedQuery}".`}
```

`SearchBar`'s `query={searchQuery}` and `onQueryChange={setSearchQuery}` props stay as-is — the input stays instant.

- [ ] **Step 3: Lint + typecheck + full test suite**

```bash
npm run lint && npx tsc -b && npm run test:run
```

Expected: lint clean, tsc clean, 23/23 tests pass (20 baseline + 3 new).

- [ ] **Step 4: Commit**

```bash
git add src/features/todo/TodoPage.tsx
git commit -m "feat(todo): debounce search filter via useDebouncedValue"
```

---

### Task 5: Manual verification in the dev server

**Files:**
- None modified — validates user-visible behavior.

- [ ] **Step 1: Start the dev server (in the debounce worktree)**

```bash
npm run dev
```

Visit `http://localhost:5173/tasks`.

- [ ] **Step 2: Seed three tasks**

In the AddTaskForm, add (one at a time): `buy milk`, `buy eggs`, `walk dog`.

- [ ] **Step 3: Verify the input stays instant**

Type `b` quickly. The cursor tracks every keystroke with zero perceptible lag.

- [ ] **Step 4: Verify the filter waits ~300ms**

After typing `b` and pausing, the list narrows to `buy milk` + `buy eggs` after ~300ms. Backspace clear → list returns ~300ms after the last keypress.

- [ ] **Step 5: Verify the empty-state message reads the debounced value**

Type `zzz` quickly. After ~300ms the message reads `No tasks match "zzz".`. It should NOT briefly flash `No tasks match "z"` mid-keystroke. If it does, the message is still reading `searchQuery` — return to Task 4 Step 2.

- [ ] **Step 6: (Bonus) Prove the filter only runs once per pause**

DevTools → React DevTools Profiler → record while typing `milk` rapidly, stop. `<TodoPage>` re-renders on every keystroke (raw `searchQuery` changes), but the `filteredTasks` memo only recomputes once after the debounce window. Or temporarily add `console.log('filter ran', debouncedQuery)` before `return filteredTasks` in the `useMemo` — one log per pause, not per keystroke. **Remove the log before pushing.**

- [ ] **Step 7: Stop the dev server (Ctrl+C)**

---

### Task 6: Push branch and open PR

**Files:**
- None on disk — publishes the branch.

- [ ] **Step 1: Confirm the commit log is clean**

```bash
git log --oneline main..feat/debounce-search
```

Expected (3 commits):
```
xxxxxxx feat(todo): debounce search filter via useDebouncedValue
xxxxxxx feat(hooks): add useDebouncedValue<T> hook with fake-timer tests
xxxxxxx chore(deps): add lodash.debounce + @types/lodash.debounce
```

- [ ] **Step 2: Push the branch**

```bash
git push -u origin feat/debounce-search
```

- [ ] **Step 3: Write the PR body to a temp file**

`/tmp/pr-body.md`:

```markdown
## Summary

Debounce the Todo SearchBar filter (300ms) via a reusable `useDebouncedValue<T>` hook in `src/hooks/`, backed by `lodash.debounce`. The `<input>` stays instant; only the derived `filteredTasks` and the empty-state message wait for the debounced value.

## Why

Current code re-runs `tasks.filter(...)` on every keystroke. For small lists this is invisible; the value is the pattern, which scales to a future server-side `?search=` round-trip. Secondary fix: the empty-state message used to flash mid-typing (`No tasks match "z"` before settling on `"zzz"`) because it read raw `searchQuery` — now reads `debouncedQuery`.

## Changes

- **Add** `lodash.debounce` + `@types/lodash.debounce`.
- **Add** `useDebouncedValue<T>(value, delay)` in `src/hooks/` with fake-timer vitest coverage (initial / delayed / coalesced).
- **Wire** `TodoPage` to derive `debouncedQuery` for both `filteredTasks` and the empty-state message.
```

Per [memory: PR format](../../../.claude/projects/-Users-nadavramon-fullstack-projects-React-Intro/memory/feedback_pr_format.md) — no Test plan section, no Claude Code attribution.

- [ ] **Step 4: Open the PR**

```bash
gh pr create --base main --head feat/debounce-search \
    --title "feat(todo): debounce search filter via useDebouncedValue hook" \
    --body-file /tmp/pr-body.md
```

Expected: PR URL printed. If tanstack PR has not merged yet → no rebase needed; CI runs against current main. If tanstack PR merged after this push → GitHub will surface a "rebase required" notice when conflicts arise on `package.json` / `package-lock.json`; resolve as adds-only merges (lodash entries land alphabetically distant from `@tanstack/*`).

- [ ] **Step 5: SDD bookkeeping (handled by `/implement` post-merge cleanup)**

When the last task box ticks: INDEX `Status` flips `Planned → In progress` → `Done` after merge. JOURNAL gets an `## YYYY-MM-DDTHH:MM — implement: todo-search-debounce` entry. Both happen in `/implement`, not here — listed for the agentic worker's awareness.

- [ ] **Step 6: Clean up the branch after the PR merges**

```bash
git checkout main && git pull
git branch -d feat/debounce-search
```

Only after the PR is merged.

---

## Out of scope (NOT this PR)

- `TodoPage` RTL integration test for the wiring.
- URL sync (`?q=` shareable links) — separate branch; existing WIP stash drafts it.
- `es-toolkit` migration.
- CLAUDE.md `## Architecture` one-liner for `src/hooks/` (add when the dir holds ≥2 files).
