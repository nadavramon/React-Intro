# Todo Search Debounce — Design Spec

**Date:** 2026-06-24
**Status:** Spec'd (pending /plan)
**Scope:** Debounce the Todo SearchBar filter via a reusable `useDebouncedValue<T>` hook backed by `lodash.debounce`. Input stays instant; only the derived filter and the empty-state message wait. No URL sync, no backend change.

---

## 1. Problem

[`TodoPage.tsx:19-22`](../../src/features/todo/TodoPage.tsx#L19-L22) re-runs `tasks.filter(...)` on every keystroke. For 0–20 tasks this is invisible. The point of doing it now is **pedagogical** — learning the React 19 + TypeScript debounce pattern on a real consumer, in a shape that scales unchanged to a server-side `?search=` round-trip later.

A secondary concern: the empty-state message reads the *raw* `searchQuery`, so during fast typing it can flash `No tasks match "z"` mid-keystroke before settling on `"zzz"`. Even though the filter itself is cheap, the message currently lies.

## 2. Goals

1. **Debounce the search filter** so `filteredTasks` only recomputes ~300ms after the user stops typing.
2. **Keep the input responsive** — the SearchBar `<input>` value updates synchronously; only the *derived* filter waits.
3. **Empty-state message matches what's actually filtered** (reads the debounced value, not the raw one).
4. **Extract a reusable hook** so the same pattern is available for future inputs (validation, autocomplete) without re-litigating the gotchas.
5. **Idiomatic best practices** — `useMemo`-stable debounced setter, `.cancel()` on cleanup, generic `<T>`, fake-timer test coverage.

## 3. Non-goals (YAGNI)

- **URL sync** (`?q=` shareable links). Separate concern; would also debounce the URL writes. There's an existing WIP stash on this — pop it on its own branch.
- **Backend search** (`GET /tasks?search=`). The server doesn't expose this and we're not adding it.
- **TodoPage integration test.** Hook is unit-tested; wiring is verified manually. An RTL integration test for TodoPage is a follow-up.
- **`es-toolkit` migration.** Modern, ESM-first, TS-native alternative — worth knowing exists, not adopted here.
- **CLAUDE.md convention codification of `src/hooks/`.** One file isn't a convention yet; add a line when the directory holds ≥2 files.

## 4. Approach

**A small `useDebouncedValue<T>(value, delay)` hook in `src/hooks/`, backed by `lodash.debounce`.**

The hook captures the debounced setter once via `useMemo` (so the same timer instance coalesces consecutive calls) and `.cancel()`s the pending timer on cleanup. TodoPage derives `debouncedQuery` from `searchQuery` and uses it in both the filter `useMemo` and the empty-state message. SearchBar is unchanged.

### Why `lodash.debounce` (and what we considered)

| Option | Maintained? | Bundle | Notes |
|---|---|---|---|
| **`lodash.debounce`** (per-method package) | Frozen since 2022-06; behavior stable | ~1 KB | **Chosen.** Self-contained. Has `@types/lodash.debounce`. |
| `lodash/debounce` (full lodash submodule) | Active | Full lodash on disk; tree-shaken to ~1 KB | Drags a dep we don't otherwise need. |
| `lodash-es` (ESM build) | Active | ~1 KB tree-shaken | Same as above, ESM-first. |
| `es-toolkit` `debounce` | Active, TS-native | <1 KB | Cleanest 2026 choice. Deferred. |
| Hand-rolled `setTimeout` | n/a | 0 | Good teaching exercise; user asked specifically for lodash. |

The "unmaintained" tag on `lodash.debounce` is fine: debounce semantics are frozen and the package has zero runtime deps. A one-line comment in the hook flags the modern alternative for future-us.

### Why a custom hook (not inline `debounce()` calls)

Calling `debounce(fn, 300)` inline creates a **new debounced function every render** — each call gets its own timer, no coalescing, defeats the point. This is the most common debounce-in-React foot-gun. A hook captures the debounced setter once with `useMemo` and is the canonical React 19 shape.

Reusable for any future input (form validation, autocomplete, etc.).

## 5. Architecture

### 5.1 File layout

**New files:**

| File | Responsibility |
|---|---|
| `src/hooks/useDebouncedValue.ts` | The hook. Generic `<T>`. No React 19 lint traps. |
| `src/hooks/useDebouncedValue.test.ts` | Vitest fake-timer coverage: initial value, delayed update, coalescing. |

**Modified files:**

| File | What changes |
|---|---|
| `package.json` / `package-lock.json` | Add `lodash.debounce` (dep) + `@types/lodash.debounce` (devDep). |
| `src/features/todo/TodoPage.tsx` | Derive `debouncedQuery` via the hook; use it in `filteredTasks` and the empty-state message. |

**Unchanged:**

- `src/features/todo/components/SearchBar/SearchBar.tsx` — already a dumb controlled component; props unchanged.
- `src/hooks/` directory already exists (empty, untracked) — no `mkdir` step.

### 5.2 Hook shape

```ts
// src/hooks/useDebouncedValue.ts
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

Three subtleties:

1. **`useMemo` keyed on `delay`** — recreate the debounced setter only if delay changes. Otherwise it's stable across renders, which is what makes coalescing work.
2. **Cleanup `update.cancel()`** — kills the pending timer when `value` changes again before the timer fires, OR on unmount. This is what makes "type fast, only the final value fires" work.
3. **`useState(value)` initialization** — first render returns the current value synchronously, not `undefined`. No empty-state flicker.

### 5.3 TodoPage wiring

```tsx
import { useDebouncedValue } from '@/hooks/useDebouncedValue'
// ...
const [searchQuery, setSearchQuery] = useState('')
const debouncedQuery = useDebouncedValue(searchQuery, 300)

const filteredTasks = useMemo(
    () => tasks.filter((t) => t.title.toLowerCase().includes(debouncedQuery.toLowerCase())),
    [tasks, debouncedQuery],
)
// ...
: `No tasks match "${debouncedQuery}".`
```

`SearchBar`'s props stay bound to `searchQuery` / `setSearchQuery`. The `<input>` stays instant; only the derived filter waits.

### 5.4 Why 300ms

Material Design's recommendation; Stripe's autocompletes; common search debounce window. Long enough to skip mid-typing thrash, short enough that the list feels live. Override per call site if needed.

## 6. Migration order

> Branch off **fresh main** so this PR doesn't carry the WIP search-URL stash.

1. `git checkout main && git pull && git checkout -b feat/debounce-search`.
2. `npm install lodash.debounce && npm install -D @types/lodash.debounce`. Spot-check `git diff package-lock.json | head -40` for optional-peer drops (memory: lockfile drift).
3. Write `src/hooks/useDebouncedValue.test.ts` (test-first). Run — expect 3 failures.
4. Write `src/hooks/useDebouncedValue.ts`. Run — expect 3/3 pass.
5. Wire `TodoPage.tsx` (filter + empty-state message).
6. `npm run lint && npx tsc -b && npm run test:run`. Expect green.
7. `npm run dev` — manual verify on `/tasks` (see §7.3).
8. Single commit, push, open PR.

Each numbered step is a logical commit boundary; in practice the whole PR will land as one commit.

## 7. Testing strategy

### 7.1 Unit (Vitest, fake timers)

`src/hooks/useDebouncedValue.test.ts` — three assertions:

- Returns the initial value immediately (no `undefined` flicker).
- Updates only after the delay elapses.
- Coalesces rapid changes — only the latest value fires after the window.

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
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBe('b')
    })

    it('coalesces rapid changes — only the latest value fires', () => {
        const { result, rerender } = renderHook(({ v }) => useDebouncedValue(v, 300), {
            initialProps: { v: 'a' },
        })
        rerender({ v: 'b' })
        act(() => { vi.advanceTimersByTime(100) })
        rerender({ v: 'c' })
        act(() => { vi.advanceTimersByTime(300) })
        expect(result.current).toBe('c')
    })
})
```

Vitest fake timers fake both `setTimeout` AND `Date`, which is what `lodash.debounce` reads internally — so the test fully controls the clock.

### 7.2 No new E2E

Existing 4 specs don't touch search and stay green. A search-debounce E2E (`type → wait 350ms → assert filtered`) is a reasonable follow-up but adds a `waitForTimeout` that's worth avoiding until there's a concrete bug to guard against.

### 7.3 Manual verification

The step that proves the *user-visible* behavior changed (the part the unit test can't):

1. `npm run dev`, open `/tasks`, add `buy milk` / `buy eggs` / `walk dog`.
2. Type `b` fast → list shouldn't visibly thrash. After ~300ms, narrows to the two `buy ...` tasks. Input is instant (cursor doesn't lag).
3. Backspace clear → list returns ~300ms after the last keypress.
4. Type `zzz` → message reads `No tasks match "zzz".` after ~300ms; it should NOT briefly flash `No tasks match "z"` mid-keystroke.
5. **Bonus proof**: React DevTools profiler → record while typing → confirm `TodoPage` re-renders on every keystroke (raw `searchQuery` changes) but `filteredTasks` only recomputes after the debounce window. Same proof via a temporary `console.log('filter ran', debouncedQuery)` next to the `useMemo`.

## 8. Best practices applied

| Practice | Where |
|---|---|
| Stable debounced fn via `useMemo` | `update` in `useDebouncedValue` |
| Timer cleanup on dep change + unmount | `useEffect` cleanup calls `update.cancel()` |
| Generic `<T>` hook — no `any` leak | Function signature |
| Initial value sync (no flicker) | `useState(value)` initializer |
| Reusable across consumers | Hook lives in `src/hooks/`, not co-located with TodoPage |
| TDD | Test file written before hook |
| Fake-timer test design | Vitest `vi.useFakeTimers()` + `vi.advanceTimersByTime` + `act()` |
| React 19 lint safety | Uses `useMemo` + `useState`, not the deprecated `useRef` lazy-init pattern |

## 9. Open questions / future work

- **TodoPage RTL integration test** — `userEvent.type()` with fake timers + assert the filter only narrows after the debounce window. Worth doing next if we want the wiring guarded.
- **URL sync** (`?q=` shareable links) — separate PR; would also debounce the URL writes. The existing WIP stash is a draft of this.
- **`es-toolkit` migration** — drop-in replacement when we next touch this code.
- **Document `src/hooks/` convention in CLAUDE.md** — add a line when the directory holds ≥2 files.
- **Configurable `leading: true` / `maxWait`** — `lodash.debounce` supports these; the hook doesn't expose them yet. Add when a consumer needs them.
