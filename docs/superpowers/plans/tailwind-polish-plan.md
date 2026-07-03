# Plan 4 — Tailwind polish: motion, responsiveness, design-system completion

## Design direction (committed)

**"Sparse Precision."** Dark canvas, three depth layers, restrained color, purposeful motion. Inspired by Linear and Vercel's editorial dashboards — not iOS, not Material, not generic shadcn.

The grammar:
- **Layers**: page bg → card bg → elevated/focused state. Only three. Borders carry depth; shadows are rare.
- **Color**: orange = action, decision, X. Blue = info, secondary, O. Both are **earned** — they appear at moments of meaning (CTAs, marks, win lines, latest task) rather than dressing every surface. Brand purple is deprecated; it survives only in the inherited body radial-gradient as atmospheric noise.
- **Motion**: <250ms; ease-out for entries, ease-in for exits; ONE purposeful pop per interaction. No animation for decoration.
- **Typography**: Inter, weights 400/500/600/700. `tabular-nums` everywhere a digit changes. Title-case for headings, sentence case for body.
- **Radius**: sm (4px), md (8px), lg (12px). No more arbitrary `rounded-[18px]`. Counter cards drop to `lg`.
- **Shadows**: only on elevated states (hover, drag). Resting elements use borders for depth.

What's in scope (honoring the original brief):
1. **Migrate all remaining CSS modules to Tailwind** — finally honor the "completely avoid separated CSS files" rule.
2. **Component tidiness** — when migrating, decompose any component whose className list grows past ~8 utilities. Use `cva()` for variant-heavy components.
3. **Responsive breakpoints** — every page works at mobile, tablet, and desktop widths.
4. **Motion system** — small set of meaningful animations across the three features.
5. **Standardize on shadcn theme tokens** — phase out brand `var(--X)` references in favor of `text-foreground`, `bg-card`, etc., where they map. Keep brand vars only for legacy accents (`--accent-glow`).

What's out of scope:
- New features, new pages, new components beyond decomposition for tidiness
- Light-mode support (we ship dark; could add toggle later)
- Changing the orange+blue theme or replacing shadcn
- Backend/API changes
- TicTacToe refactor (done in Plan 3)

---

## Pre-flight

Confirm before starting:
- Plan 3 (`tailwind-shadcn-plan`) Phase 6 (TicTacToe Tailwind rewrite) is complete or has only Step 7 (CSS module deletion) remaining.
- You're still on branch `feature/tailwind-shadcn`. We'll bundle Plan 4 work into the same PR rather than spinning a new branch — these are continuous polish on the same feature.

If Plan 3 Phase 6 Step 7 isn't done yet, do it first:
```bash
rm src/features/tic-tac-toe/TicTacToe.module.css
rm src/features/tic-tac-toe/Board/Board.module.css
rm src/features/tic-tac-toe/Square/Square.module.css
rm src/features/tic-tac-toe/StatusBar/StatusBar.module.css
rm src/features/tic-tac-toe/MoveHistory/MoveHistory.module.css
```

---

## File map — what we'll touch

```
src/
├── index.css                              MODIFY: add @theme motion tokens, prune global .app/.header/.title/etc.
├── App.tsx                                (untouched)
├── AppRoutes.tsx                          (untouched)
├── routes.ts                              (untouched)
├── components/ui/button.tsx               (untouched)
├── lib/{api,utils}.ts                     (untouched)
├── layout/
│   ├── Layout/Layout.tsx                  MODIFY: Tailwind classes, delete .module.css
│   ├── Sidebar/Sidebar.tsx                MODIFY: Tailwind classes + mobile collapse, delete .module.css
│   └── Header/Header.tsx                  MODIFY: Tailwind classes, delete .module.css
├── pages/
│   └── NotFoundPage.tsx                   MODIFY: Tailwind classes (remove .app/.header/.title globals)
└── features/
    ├── counter/
    │   ├── CounterApp.tsx                 MODIFY: Tailwind classes (remove .app/.header/.title/.total-pill globals), responsive grid
    │   └── CounterButton/CounterButton.tsx MODIFY: standardize to rounded-lg, add increment pop animation
    ├── todo/
    │   ├── TodoPage.tsx                   MODIFY: Tailwind classes, responsive padding, delete .module.css
    │   └── components/
    │       ├── AddTaskForm/AddTaskForm.tsx       MODIFY: Tailwind, delete .module.css
    │       ├── SearchBar/SearchBar.tsx            MODIFY: Tailwind, delete .module.css
    │       ├── TaskStats/TaskStats.tsx            MODIFY: Tailwind, delete .module.css
    │       └── TaskList/
    │           ├── TaskList.tsx                   MODIFY: Tailwind, delete .module.css
    │           └── TaskItem/TaskItem.tsx          MODIFY: Tailwind + slide-in animation, delete .module.css
    └── tic-tac-toe/                       (already Tailwind from Plan 3)
        ├── Square/Square.tsx              MODIFY: add scale-in animation on placement
        ├── Board/Board.tsx                MODIFY: responsive width (lg:w-[480px] md:w-[360px] w-[300px])
        └── MoveHistory/MoveHistory.tsx    MODIFY: optional latest-item subtle pulse
```

Delete list (after migrations):
```
src/layout/Layout/Layout.module.css
src/layout/Sidebar/Sidebar.module.css
src/layout/Header/Header.module.css
src/features/todo/TodoPage.module.css
src/features/todo/components/AddTaskForm/AddTaskForm.module.css
src/features/todo/components/SearchBar/SearchBar.module.css
src/features/todo/components/TaskStats/TaskStats.module.css
src/features/todo/components/TaskList/TaskList.module.css
src/features/todo/components/TaskList/TaskItem/TaskItem.module.css
```

After this plan, the only `.css` file in the project is `src/index.css` — and it contains only `@import`, `@custom-variant`, `@theme`, `:root` (brand legacy vars), `body` (page bg), `.dark`, and `@layer base`. **Zero feature-level CSS.**

---

## Phase A — Foundation: motion tokens & radius normalization

The motion system needs a vocabulary before we apply it. We define it once in `@theme inline` so Tailwind exposes it as utilities.

### A1 — Add motion + duration tokens to `@theme inline`

In `src/index.css`, inside the `@theme inline { ... }` block, **after** the radius tokens, add:

```css
    --animate-pop: pop 220ms cubic-bezier(0.34, 1.56, 0.64, 1);
    --animate-slide-in: slide-in 200ms ease-out;
    --animate-slide-out: slide-out 180ms ease-in;
    --animate-scale-in: scale-in 180ms cubic-bezier(0.34, 1.56, 0.64, 1);
    --animate-pulse-once: pulse-once 600ms ease-out;

@keyframes pop {
    0%   { transform: scale(1); }
    40%  { transform: scale(1.15); }
    100% { transform: scale(1); }
}
@keyframes slide-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
}
@keyframes slide-out {
    from { opacity: 1; transform: translateX(0); }
    to   { opacity: 0; transform: translateX(8px); }
}
@keyframes scale-in {
    from { opacity: 0; transform: scale(0.7); }
    to   { opacity: 1; transform: scale(1); }
}
@keyframes pulse-once {
    0%   { box-shadow: 0 0 0 0 rgba(255, 138, 30, 0.5); }
    100% { box-shadow: 0 0 0 8px rgba(255, 138, 30, 0); }
}
```

**Note on `@theme` vs `@keyframes`:** the `--animate-*` tokens go INSIDE `@theme inline { }`. The `@keyframes` blocks go AT THE TOP LEVEL of the CSS file (outside `@theme`). Tailwind v4 still reads the keyframes globally. So the structure is:

```css
@theme inline {
    /* ...existing tokens... */
    --animate-pop: ...;
    /* etc */
}

@keyframes pop { ... }
@keyframes slide-in { ... }
/* etc */
```

**Why these durations and curves?**
- `pop` uses `cubic-bezier(0.34, 1.56, 0.64, 1)` — the "ease-out-back" curve with mild overshoot. Reads as "springy" without feeling cartoonish.
- 220ms for pop is just above the "instant" threshold (~150ms) where motion becomes noticeable. Apple HIG recommends 200-300ms for affirmation animations.
- 180ms for slide-out is shorter than slide-in by design — exits should feel snappier than entries.

### A2 — Verify the tokens work

Apply `animate-pop` to any element temporarily, watch it pop, then remove. Skip if confident.

---

## Phase B — Migrate Layout (Layout, Sidebar, Header)

Layout is the app shell. It's tiny but used everywhere.

### B1 — Read the existing modules

Read these three files to understand current behavior before rewriting:
- `src/layout/Layout/Layout.tsx`
- `src/layout/Layout/Layout.module.css`
- `src/layout/Sidebar/Sidebar.tsx`
- `src/layout/Sidebar/Sidebar.module.css`
- `src/layout/Header/Header.tsx`
- `src/layout/Header/Header.module.css`

Verify nothing else imports from these CSS files.

### B2 — Rewrite `src/layout/Layout/Layout.tsx`

```tsx
import { Outlet } from 'react-router-dom'
import Sidebar from '../Sidebar/Sidebar'
import Header from '../Header/Header'

export default function Layout() {
    return (
        <div className="grid min-h-screen grid-cols-1 md:grid-cols-[240px_1fr]">
            <Sidebar />
            <div className="flex min-w-0 flex-col">
                <Header />
                <div className="min-w-0 flex-1 overflow-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
```

**Responsive translation:**
- `grid-cols-1` on mobile (single column, sidebar stacks on top or collapses — Sidebar handles its own visibility).
- `md:grid-cols-[240px_1fr]` from 768px+ — sidebar 240px wide, main fills remainder.

### B3 — Rewrite `src/layout/Sidebar/Sidebar.tsx`

Decide: on mobile, does the sidebar (a) hide entirely, (b) become a top bar, or (c) become a hamburger menu? For this scope, **hide entirely** on mobile is simplest. Header carries the brand on mobile.

Read the original first, then replace with something like (adjust to match what's there):

```tsx
import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/routes'
import { cn } from '@/lib/utils'

const NAV_ITEMS = [
    { to: ROUTES.counters, label: 'Counters' },
    { to: ROUTES.ticTacToe, label: 'Tic-Tac-Toe' },
    { to: ROUTES.todo, label: 'Todo' },
] as const

export default function Sidebar() {
    return (
        <aside className="bg-sidebar text-sidebar-foreground hidden flex-col gap-4 border-r p-6 md:flex">
            <h2 className="text-primary text-xs font-semibold tracking-widest uppercase">
                React Intro
            </h2>
            <nav className="flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            cn(
                                'rounded-md px-3 py-2 text-sm transition-colors',
                                isActive
                                    ? 'bg-sidebar-accent text-foreground'
                                    : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
                            )
                        }
                    >
                        {item.label}
                    </NavLink>
                ))}
            </nav>
        </aside>
    )
}
```

**Key bits:**
- `hidden md:flex` — sidebar disappears below 768px. Simple and clean.
- `bg-sidebar` / `text-sidebar-foreground` — shadcn provides these tokens explicitly for sidebar contexts.
- The brand title uses `text-primary` (orange) — replaces the old `var(--accent)` purple. Aligns with the "orange = action/identity" rule.
- `NavLink` with conditional class via render-prop — react-router-dom v7 pattern.

### B4 — Rewrite `src/layout/Header/Header.tsx`

```tsx
import { Link } from 'react-router-dom'
import { ROUTES } from '@/routes'

export default function Header() {
    return (
        <header className="bg-card flex h-14 items-center gap-4 border-b px-4 md:px-6">
            <Link to={ROUTES.counters} className="text-foreground text-sm font-semibold">
                React Intro
            </Link>
        </header>
    )
}
```

**Note on responsive padding:** `px-4 md:px-6` — tighter on mobile, more breathing room on tablet+. Standard pattern.

### B5 — Delete the three CSS modules

```bash
rm src/layout/Layout/Layout.module.css
rm src/layout/Sidebar/Sidebar.module.css
rm src/layout/Header/Header.module.css
```

### B6 — Verify

```bash
npm run dev
npx tsc --noEmit
```

In the browser:
- Sidebar shows on desktop (≥768px), hides on mobile.
- Nav items highlight orange on active.
- Header stays sticky-feeling at top (it's not actually sticky here — we don't need it sticky).
- All three feature pages still navigate correctly.

Resize the window narrow (Chrome DevTools mobile preview, ~375px width). Sidebar should vanish; content takes full width.

### B7 — Commit

```bash
git add -A
git status
git commit -m "Migrate layout (Layout, Sidebar, Header) to Tailwind with responsive sidebar"
```

---

## Phase C — Migrate Counter feature

The Counter is interesting because it uses GLOBAL classes (`.app`, `.header`, `.title`, `.total-pill`, `.total-label`, `.total-value`, `.counter-grid`, `.reset`) that all live in `src/index.css`. Migrating it lets us prune index.css down to just theme + base.

### C1 — Audit which global classes Counter uses

```bash
grep -rE 'className="(app|header|title|total-pill|total-label|total-value|counter-grid|reset)"' src/features/counter
```

Confirms what's still referenced. Should be only `CounterApp.tsx`.

### C2 — Rewrite `src/features/counter/CounterApp.tsx`

```tsx
import { useState } from 'react'
import CounterButton from './CounterButton/CounterButton'
import { Button } from '@/components/ui/button'

const COUNT = 12
const INITIAL_COUNTERS: number[] = Array(COUNT).fill(0)

const sumCounters = (counters: number[]) => counters.reduce((s, v) => s + v, 0)

export default function CounterApp() {
    const [counters, setCounters] = useState(INITIAL_COUNTERS)

    const total = sumCounters(counters)
    const maxValue = Math.max(...counters)

    const increment = (index: number) =>
        setCounters((prev) => prev.map((v, i) => (i === index ? v + 1 : v)))

    return (
        <main className="mx-auto flex max-w-4xl flex-col items-center gap-8 px-6 py-14">
            <header className="flex flex-col items-center gap-4">
                <h1 className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">
                    Click Counters
                </h1>
                <div className="bg-card flex items-center gap-4 rounded-lg border px-6 py-3">
                    <span className="text-muted-foreground text-sm">Total</span>
                    <span className="from-primary to-secondary bg-linear-to-br bg-clip-text text-4xl font-bold tracking-tight tabular-nums text-transparent">
                        {total}
                    </span>
                </div>
            </header>
            <div className="grid w-full grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {counters.map((value, index) => (
                    <CounterButton
                        key={index}
                        index={index}
                        value={value}
                        isMax={value > 0 && value === maxValue}
                        onClick={() => increment(index)}
                    />
                ))}
            </div>
            <Button variant="outline" onClick={() => setCounters(INITIAL_COUNTERS)}>
                Reset
            </Button>
        </main>
    )
}
```

**What's new:**
- `mx-auto max-w-4xl` — centered, max 56rem wide on large screens.
- `px-6 py-14` — responsive padding.
- Responsive grid: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` — 2 cols on mobile, 3 on tablet, 4 on desktop. **This is the responsive win for Counter.**
- The "Total" pill uses `bg-linear-to-br from-primary to-secondary bg-clip-text text-transparent` — orange-to-blue gradient on the number itself. Replaces the old purple-to-pink. This becomes a small signature moment.
- No more `var(--accent)` references — using shadcn theme tokens (`text-primary`, `text-muted-foreground`).

**`renderCounter` helper is gone** because the map is short and inline now — extract only if it grows. YAGNI.

### C3 — Add pop animation to `src/features/counter/CounterButton/CounterButton.tsx`

Open the existing file. The animation triggers when `value` changes — use a `key` on the value text to force a re-mount, which retriggers CSS animation. Actually simpler: use Tailwind's `animate-` utility plus a state-derived key.

Replace the relevant span:

```tsx
<span
    key={value}
    className="animate-pop text-[64px] font-bold tracking-tighter tabular-nums"
>
    {value}
</span>
```

**Why `key={value}`?** React re-mounts the element when the key changes. The `animate-pop` CSS animation runs from scratch on every mount. So each increment triggers the pop. No state, no useEffect — pure declarative.

**Also update the radius** to standardize: change `rounded-[18px]` → `rounded-xl` (12px in v4 default scale, looks similar enough and uses the shadcn radius token).

```tsx
// before
'... rounded-[18px] border p-3.5 ...'
// after
'... rounded-xl border p-3.5 ...'
```

### C4 — Prune `src/index.css`

Open `src/index.css`. Delete these blocks entirely (no longer referenced anywhere):

```css
.app { ... }
.header { ... }
.title { ... }
.total-pill { ... }
.total-label { ... }
.total-value { ... }
.counter-grid { ... }
.reset { ... }
.reset:hover { ... }
.reset:focus-visible { ... }
```

What survives in `:root` and the rest of the file:
- `--bg`, `--card-bg`, `--border`, `--text`, `--text-h`, `--accent`, `--accent-2`, `--accent-border`, `--accent-glow` (still used by CounterButton's brand gradient + glow)
- `font:`, `color-scheme`, `color`, `background` declarations
- All shadcn `--background`, `--foreground`, etc.

`body { ... }` — keep as is (the radial gradient atmosphere).

After this step, `src/index.css` should be down to ~120 lines (was ~235).

### C5 — Verify Counter

- Counter renders correctly at all viewport widths (mobile 2-col, tablet 3-col, desktop 4-col).
- Clicking a counter shows the pop animation (number scales 1.0→1.15→1.0 in ~220ms).
- Max counter still has the brand gradient + glow.
- Reset button works.
- Total pill shows orange-to-blue gradient text.

### C6 — Commit

```bash
git add -A
git commit -m "Migrate Counter to Tailwind: responsive grid, pop animation, prune global CSS"
```

---

## Phase D — Migrate Todo feature

The Todo feature has the most files. Migrate one component at a time.

### D1 — Read all Todo CSS modules and components

Read these to understand the originals before rewriting:
- `src/features/todo/TodoPage.tsx` + `.module.css`
- `src/features/todo/components/AddTaskForm/AddTaskForm.tsx` + `.module.css`
- `src/features/todo/components/SearchBar/SearchBar.tsx` + `.module.css`
- `src/features/todo/components/TaskStats/TaskStats.tsx` + `.module.css`
- `src/features/todo/components/TaskList/TaskList.tsx` + `.module.css`
- `src/features/todo/components/TaskList/TaskItem/TaskItem.tsx` + `.module.css`

### D2 — Rewrite `src/features/todo/TodoPage.tsx`

```tsx
import { useMemo, useState } from 'react'
import { useTasks } from './hooks/useTasks'
import AddTaskForm from './components/AddTaskForm/AddTaskForm'
import SearchBar from './components/SearchBar/SearchBar'
import TaskStats from './components/TaskStats/TaskStats'
import TaskList from './components/TaskList/TaskList'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

export default function TodoPage() {
    const { tasks, loading, error, addTask, toggleTask, deleteCompleted } = useTasks()
    const [searchQuery, setSearchQuery] = useState('')

    const filteredTasks = useMemo(
        () => tasks.filter((task) => task.title.toLowerCase().includes(searchQuery.toLowerCase())),
        [tasks, searchQuery],
    )

    const hasCompleted = tasks.some((t) => t.isCompleted)

    if (loading) {
        return (
            <main className="mx-auto flex min-h-full max-w-2xl items-center justify-center px-6 py-14">
                <div className="text-muted-foreground flex items-center gap-2">
                    <Loader2 className="size-5 animate-spin" />
                    <span>Loading tasks…</span>
                </div>
            </main>
        )
    }

    if (error) {
        return (
            <main className="mx-auto flex min-h-full max-w-2xl items-center justify-center px-6 py-14">
                <p className="text-destructive">{error}</p>
            </main>
        )
    }

    return (
        <main className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-14">
            <header className="flex flex-col gap-1">
                <h1 className="text-foreground text-3xl font-bold tracking-tight">Todo</h1>
                <p className="text-muted-foreground text-sm">Track your tasks</p>
            </header>
            <AddTaskForm onAdd={addTask} />
            <SearchBar query={searchQuery} onQueryChange={setSearchQuery} />
            <TaskStats tasks={tasks} />
            <Button
                className="self-start"
                variant="destructive"
                onClick={deleteCompleted}
                disabled={!hasCompleted}
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
                <TaskList tasks={filteredTasks} onToggle={toggleTask} />
            )}
        </main>
    )
}
```

**Notable changes:**
- `mx-auto max-w-2xl` — centered, 42rem (672px) max. Narrower than Counter because lists read better in single columns.
- `px-6 py-14` — same responsive padding as Counter for consistency.
- Loading state uses `Loader2` from lucide (already imported in your version), spinning with `animate-spin`.
- Error state uses `text-destructive` — a shadcn semantic color.

### D3 — Rewrite `src/features/todo/components/AddTaskForm/AddTaskForm.tsx`

```tsx
import { useState } from 'react'
import { Button } from '@/components/ui/button'

type AddTaskFormProps = {
    onAdd: (title: string) => void
}

export default function AddTaskForm({ onAdd }: AddTaskFormProps) {
    const [title, setTitle] = useState('')

    function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
        event.preventDefault()
        onAdd(title)
        setTitle('')
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

**Type fix included:** `React.FormEvent<HTMLFormElement>` (the original code has `React.SubmitEvent` which isn't a real React type — TypeScript accepts it because of structural matching, but the canonical type is `FormEvent`).

**Input className is 7 utilities** — at the boundary of "long enough to extract." Decision: leave inline because it's a one-off, but if you add another input elsewhere we'd extract a `<TextInput>` component.

### D4 — Rewrite `src/features/todo/components/SearchBar/SearchBar.tsx`

(Read the original first — I'm guessing at the structure based on its name.)

```tsx
import { Search } from 'lucide-react'

type SearchBarProps = {
    query: string
    onQueryChange: (q: string) => void
}

export default function SearchBar({ query, onQueryChange }: SearchBarProps) {
    return (
        <div className="bg-card focus-within:border-primary focus-within:ring-primary/30 flex items-center gap-2 rounded-md border px-3 py-2 transition focus-within:ring-2">
            <Search className="text-muted-foreground size-4" />
            <input
                className="placeholder:text-muted-foreground text-foreground flex-1 bg-transparent text-sm outline-none"
                type="search"
                value={query}
                onChange={(event) => onQueryChange(event.target.value)}
                placeholder="Search tasks..."
                aria-label="Search tasks"
            />
        </div>
    )
}
```

**Why a Search icon?** Small visual cue that this input is a search, not the "new task" input — distinguishes the two at a glance. Costs nothing.

### D5 — Rewrite `src/features/todo/components/TaskStats/TaskStats.tsx`

```tsx
import type { Task } from '../../types'

type TaskStatsProps = {
    tasks: Task[]
}

const STAT_CARD = 'bg-card flex flex-1 flex-col items-center gap-1 rounded-md border p-4'

export default function TaskStats({ tasks }: TaskStatsProps) {
    const total = tasks.length
    const completed = tasks.filter((t) => t.isCompleted).length
    const active = total - completed

    return (
        <div className="flex gap-3">
            <div className={STAT_CARD}>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Total</span>
                <span className="text-foreground text-2xl font-bold tabular-nums">{total}</span>
            </div>
            <div className={STAT_CARD}>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Active</span>
                <span className="text-foreground text-2xl font-bold tabular-nums">{active}</span>
            </div>
            <div className={STAT_CARD}>
                <span className="text-muted-foreground text-xs uppercase tracking-wide">Completed</span>
                <span className="text-primary text-2xl font-bold tabular-nums">{completed}</span>
            </div>
        </div>
    )
}
```

**Hoisted `STAT_CARD` constant** — three cards share the same wrapper className. Extracting to a const keeps the JSX scannable. This is the "tidy components" pattern from the brief: when three siblings share the same long className, hoist it. Don't `@apply`-it; that recreates a CSS file.

**`text-primary` on the Completed count** — earned color: it marks the meaningful number when looking at progress.

### D6 — Rewrite `src/features/todo/components/TaskList/TaskList.tsx`

```tsx
import type { Task } from '../../types'
import TaskItem from './TaskItem/TaskItem'

type TaskListProps = {
    tasks: Task[]
    onToggle: (id: string) => void
}

export default function TaskList({ tasks, onToggle }: TaskListProps) {
    return (
        <ul className="flex flex-col gap-2">
            {tasks.map((task) => (
                <TaskItem key={task.id} task={task} onToggle={onToggle} />
            ))}
        </ul>
    )
}
```

### D7 — Rewrite `src/features/todo/components/TaskList/TaskItem/TaskItem.tsx`

```tsx
import type { Task } from '../../../types'
import { cn } from '@/lib/utils'

type TaskItemProps = {
    task: Task
    onToggle: (id: string) => void
}

export default function TaskItem({ task, onToggle }: TaskItemProps) {
    return (
        <li
            className={cn(
                'bg-card flex animate-slide-in items-center gap-3 rounded-md border px-4 py-3 transition',
                task.isCompleted && 'opacity-60',
            )}
        >
            <input
                type="checkbox"
                className="accent-primary size-4 cursor-pointer"
                checked={task.isCompleted}
                onChange={() => onToggle(task.id)}
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

**Motion: `animate-slide-in`** applied to every list item. React will mount the new TaskItem when a task is added; the animation runs once on mount. (Existing tasks won't re-animate because React reuses the DOM nodes.)

**`accent-primary` on the checkbox** — Tailwind utility for the native `accent-color` CSS property. The checkbox fill matches your orange theme. Simple, no library needed.

### D8 — Delete the 6 Todo CSS modules

```bash
rm src/features/todo/TodoPage.module.css
rm src/features/todo/components/AddTaskForm/AddTaskForm.module.css
rm src/features/todo/components/SearchBar/SearchBar.module.css
rm src/features/todo/components/TaskStats/TaskStats.module.css
rm src/features/todo/components/TaskList/TaskList.module.css
rm src/features/todo/components/TaskList/TaskItem/TaskItem.module.css
```

### D9 — Verify Todo

- All states render: loading, error, empty list (no tasks), empty filter (search with no matches), normal list.
- Adding a task animates in from above.
- Toggling marks line-through and fades to 60% opacity.
- Delete completed only enables when there are completed tasks; clicking removes them.
- Search filters live; stats stay accurate.
- Responsive: works at 375px width too.

### D10 — Commit

```bash
git add -A
git commit -m "Migrate Todo feature to Tailwind with slide-in motion and search icon"
```

---

## Phase E — Migrate NotFoundPage

Quick win — it still uses the global `.app/.header/.title` classes we just deleted. Without migrating it, /not-a-real-route will break.

### E1 — Rewrite `src/pages/NotFoundPage.tsx`

```tsx
import { Link } from 'react-router-dom'
import { ROUTES } from '@/routes'

export default function NotFoundPage() {
    return (
        <main className="mx-auto flex min-h-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-14 text-center">
            <h1 className="text-primary text-xs font-semibold tracking-[0.2em] uppercase">404</h1>
            <p className="text-foreground text-lg">That page doesn't exist.</p>
            <Link
                to={ROUTES.counters}
                className="text-primary hover:underline"
            >
                Go to Counters
            </Link>
        </main>
    )
}
```

**Why `text-primary` on the 404 label and link?** The 404 IS a moment of attention. Orange earns its appearance here. Standard nav links elsewhere stay neutral.

### E2 — Verify

Navigate to `http://localhost:5173/this-route-does-not-exist`. Should show the new styled 404 page.

### E3 — Commit

```bash
git add -A
git commit -m "Migrate NotFoundPage to Tailwind"
```

---

## Phase F — TicTacToe responsive + motion polish

### F1 — Responsive board in `src/features/tic-tac-toe/Board/Board.tsx`

```tsx
<div className="grid w-[280px] grid-cols-3 gap-2 sm:w-[360px] md:w-[480px]">
```

**Reads as:** 280px on mobile, 360px from `sm` (640px+), 480px from `md` (768px+). Cells scale proportionally because `aspect-square` is on each Square.

### F2 — Scale-in animation on `src/features/tic-tac-toe/Square/Square.tsx`

Update the className:

```tsx
className={cn(
    'aspect-square h-auto w-full text-5xl font-bold disabled:opacity-100',
    value !== null && 'animate-scale-in',
    value === Player.X && 'text-primary',
    value === Player.O && 'text-secondary',
    isWinning && 'border-2 border-primary dark:border-primary',
)}
```

**Why `value !== null && 'animate-scale-in'`?** When `value` flips from `null` to X or O, the className list changes and React updates the DOM. The newly-added `animate-scale-in` triggers the keyframe. Empty cells don't animate.

**Catch**: this animates once per cell when first placed. If a winner is declared, no new animation. Good — exactly what we want.

### F3 — Winning-line pulse on `src/features/tic-tac-toe/Square/Square.tsx`

Update once more to add the pulse:

```tsx
isWinning && 'border-2 border-primary animate-pulse-once dark:border-primary',
```

The `pulse-once` keyframe expands a shadow ring outward then fades. With `border-primary` carrying the orange, it reads as "this cell is glowing." Runs once when the win state activates.

### F4 — Verify TicTacToe at mobile widths

In Chrome DevTools' mobile preview (~375px wide), the board should be 280px and fit comfortably. MoveHistory might need to stack below — check whether `grid-cols-[auto_280px]` works at narrow widths or if you need a responsive variant on TicTacToe.tsx's grid.

If MoveHistory overflows on mobile, update [TicTacToe.tsx:37](src/features/tic-tac-toe/TicTacToe.tsx#L37):

```tsx
<div className="flex flex-col items-center gap-6 md:grid md:grid-cols-[auto_280px] md:items-start">
```

Stacked vertically on mobile (`flex flex-col`), 2-column from `md` upward.

### F5 — Verify, commit

- Mobile: small board, MoveHistory below.
- Tablet/desktop: bigger board, MoveHistory beside.
- Placing X or O scales the mark in.
- Winning cells pulse once.

```bash
git add -A
git commit -m "TicTacToe: responsive board, scale-in motion, winning-line pulse"
```

---

## Phase I — Collapsible sidebar with hamburger

Solves the narrow-viewport-content-squeeze problem and replaces the hard `hidden md:flex` mobile rule with a user-controlled toggle. The sidebar animates between 0 and 240px width; the hamburger icon rotates 90° on toggle.

### Architecture

- **State lives in `Layout.tsx`** — single source of truth, prop-drilled to `Sidebar` and `Header` (no Context, no Zustand — overkill for one boolean).
- **Initial state**: open on md+ (`window.innerWidth >= 768`), closed below. Computed at mount via lazy `useState` initializer.
- **Pattern**: **push** — sidebar takes column width when open. When closed, sidebar's outer wrapper animates to `w-0` with `overflow-hidden`, so content gains the full width. No fixed-positioning, no backdrop — simpler, works at all viewport sizes.
- **Animation choice**: transition on `width` only (not `grid-template-columns` which has spotty interpolation support in older browsers). The grid container's `1fr` for main absorbs the freed space automatically.

### Why push and not overlay/drawer

- Overlay pattern needs a backdrop, focus trap, `aria-modal`, escape-key dismissal — drawer pattern essentially. More moving parts.
- Push gives the user predictable behavior: opening the sidebar squeezes content, closing reveals it. Direct cause-and-effect.
- On mobile, content getting cramped while sidebar is open is acceptable because the user just opened the sidebar to navigate — they're not reading content right now.
- If we want a true mobile drawer later (with backdrop), that's a separate plan.

### I1 — Read current state and confirm baseline

```bash
cat src/layout/Layout/Layout.tsx src/layout/Sidebar/Sidebar.tsx src/layout/Header/Header.tsx
```

Baseline (from Phase B): Layout is `grid grid-cols-1 md:grid-cols-[240px_1fr]`, Sidebar is `hidden md:flex` aside, Header is single-row with brand Link.

### I2 — Update `src/layout/Layout/Layout.tsx`

```tsx
import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Sidebar from '../Sidebar/Sidebar'
import Header from '../Header/Header'

export default function Layout() {
    const [sidebarOpen, setSidebarOpen] = useState(
        () => typeof window !== 'undefined' && window.innerWidth >= 768,
    )

    return (
        <div className="flex min-h-screen">
            <Sidebar isOpen={sidebarOpen} />
            <div className="flex min-w-0 flex-1 flex-col">
                <Header
                    sidebarOpen={sidebarOpen}
                    onToggleSidebar={() => setSidebarOpen((o) => !o)}
                />
                <div className="min-w-0 flex-1 overflow-auto">
                    <Outlet />
                </div>
            </div>
        </div>
    )
}
```

**What changed:**
- `grid` → `flex` at the root. Flex lets the Sidebar's width animate cleanly (transitioning `width` is well-supported; transitioning `grid-template-columns` is not).
- `useState` lazy initializer reads viewport width at mount. SSR-safe via the `typeof window` check.
- Toggle handler passed to Header. Open state passed to Sidebar.

### I3 — Rewrite `src/layout/Sidebar/Sidebar.tsx`

```tsx
import { NavLink } from 'react-router-dom'
import { ROUTES } from '@/routes'
import { cn } from '@/lib/utils'

type SidebarProps = {
    isOpen: boolean
}

const NAV_ITEMS = [
    { to: ROUTES.counters, label: 'Counters' },
    { to: ROUTES.ticTacToe, label: 'Tic-Tac-Toe' },
    { to: ROUTES.todo, label: 'Todo' },
] as const

export default function Sidebar({ isOpen }: SidebarProps) {
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
                                    'rounded-md px-3 py-2 text-sm transition-colors',
                                    isActive
                                        ? 'bg-sidebar-accent text-foreground'
                                        : 'text-muted-foreground hover:bg-sidebar-accent/50 hover:text-foreground',
                                )
                            }
                        >
                            {item.label}
                        </NavLink>
                    ))}
                </nav>
            </div>
        </aside>
    )
}
```

**What changed:**
- Removed `hidden md:flex` — visibility is now controlled by the `isOpen` prop, not a media query.
- Outer `<aside>` has `transition-[width]` and conditional `w-60` / `w-0`. The inner `<div>` has a fixed `w-60` so its contents stay sized correctly while the outer wrapper clips them.
- `overflow-hidden` on the outer wrapper ensures the inner content doesn't peek out when collapsed.
- `border-r-0` when closed — without this, the 1px right border would still be visible as a thin line.
- `aria-hidden={!isOpen}` — screen readers skip the nav when collapsed.

**Why the nested `<div>` instead of putting content directly on `<aside>`?** If you put `w-60` directly on the `<aside>` AND animate it to `w-0`, the inner content reflows during animation — nav items compress horizontally, looking ugly. With a fixed-width inner div and an animating outer wrapper, the content stays still while the wrapper "wipes" across it.

### I4 — Update `src/layout/Header/Header.tsx`

```tsx
import { Link } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { ROUTES } from '@/routes'
import { cn } from '@/lib/utils'

type HeaderProps = {
    sidebarOpen: boolean
    onToggleSidebar: () => void
}

export default function Header({ sidebarOpen, onToggleSidebar }: HeaderProps) {
    return (
        <header className="bg-card flex h-14 items-center gap-4 border-b px-4 md:px-6">
            <button
                type="button"
                onClick={onToggleSidebar}
                aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
                aria-expanded={sidebarOpen}
                className="hover:bg-muted text-foreground -ml-2 inline-flex size-9 items-center justify-center rounded-md transition-colors"
            >
                <Menu
                    className={cn(
                        'size-5 transition-transform duration-300 ease-out',
                        sidebarOpen && 'rotate-90',
                    )}
                />
            </button>
            <Link to={ROUTES.counters} className="text-foreground text-sm font-semibold">
                React Intro
            </Link>
        </header>
    )
}
```

**What changed:**
- Added a hamburger button as the first child. `-ml-2` pulls it slightly into the padding so it feels anchored to the edge.
- The `Menu` icon (from `lucide-react`, already a dep) rotates 90° via `rotate-90` when `sidebarOpen`. Same `duration-300` as the sidebar — they move together.
- Hover state: `hover:bg-muted` gives feedback without screaming.
- Accessibility: `aria-label` swaps between "Open menu" / "Close menu". `aria-expanded` mirrors state for screen readers and tests.

### I5 — Verify with Playwright

```bash
npx --yes --package=playwright node -e "
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 800 } });
  await page.goto('http://localhost:5173/counters');
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '.playwright-mcp/i5-desktop-open.png' });

  const probeOpen = await page.evaluate(() => ({
    sidebarWidth: getComputedStyle(document.querySelector('aside')).width,
    iconTransform: getComputedStyle(document.querySelector('header button svg')).transform,
  }));
  console.log('OPEN:', JSON.stringify(probeOpen));

  await page.locator('header button[aria-label]').click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: '.playwright-mcp/i5-desktop-closed.png' });

  const probeClosed = await page.evaluate(() => ({
    sidebarWidth: getComputedStyle(document.querySelector('aside')).width,
    iconTransform: getComputedStyle(document.querySelector('header button svg')).transform,
  }));
  console.log('CLOSED:', JSON.stringify(probeClosed));

  await page.setViewportSize({ width: 375, height: 800 });
  await page.reload();
  await page.waitForLoadState('networkidle');
  await page.screenshot({ path: '.playwright-mcp/i5-mobile-closed.png' });

  await page.locator('header button[aria-label]').click();
  await page.waitForTimeout(350);
  await page.screenshot({ path: '.playwright-mcp/i5-mobile-open.png' });

  await browser.close();
  console.log('done');
})();
"
```

Expected results:
- `OPEN`: sidebar width 240px, icon transform contains the rotate(90deg) matrix
- `CLOSED`: sidebar width 0px, icon transform is identity matrix (no rotation)

### I6 — Commit

```bash
git add -A
git commit -m "Add collapsible sidebar with hamburger toggle and 90° icon rotation"
```

### Files touched in Phase I

| Action | Path |
|---|---|
| Modify | `src/layout/Layout/Layout.tsx` — add state, switch from grid to flex |
| Modify | `src/layout/Sidebar/Sidebar.tsx` — accept isOpen prop, animating wrapper |
| Modify | `src/layout/Header/Header.tsx` — add hamburger button with rotation |

No new packages, no new files. Three component edits.

### Edge cases the plan accepts as-is

- **Sidebar state doesn't persist across reloads** — refreshing resets to default (open on desktop, closed on mobile). Could persist via localStorage; YAGNI for now.
- **No swipe gestures on mobile** — just tap the hamburger. Adding swipe-to-open is a separate plan.
- **Window resize doesn't auto-toggle** — if you resize from mobile to desktop with sidebar closed, it stays closed. Initial state runs once at mount. Could add a `useEffect` watching viewport, but over-engineered for the brief.

---

## Phase G — Final cleanup pass

### G1 — Confirm no `.module.css` files remain outside of approved exceptions

```bash
find src -name "*.module.css"
```

Expected output: empty. If anything shows up, decide whether to migrate or accept as legacy.

### G2 — Confirm `src/index.css` is minimal

Open `src/index.css`. Should contain:
- Imports (`@import 'tailwindcss';`, `tw-animate-css`, `shadcn/tailwind.css`, `@fontsource-variable/inter`)
- `@custom-variant dark`
- `:root { ... }` with brand legacy vars + shadcn vars
- `body { ... }` with the radial gradient background
- `@theme inline { ... }` with all design tokens
- `.dark { ... }` with dark-mode overrides
- `@layer base { ... }` with global resets
- `@keyframes` blocks (Phase A1)

NO feature-level classes like `.app`, `.title`, `.counter-grid`, `.reset`. Those should all be deleted in Phase C4.

### G3 — Run the full check

```bash
npm run lint
npm run format
npm run build
npm run test:run
```

All four should pass. If lint complains about unused imports anywhere (likely some `styles` import left behind in a migrated file), fix and re-run.

### G4 — Final visual sweep (Playwright if available, otherwise browser)

Walk through all four pages at three viewport widths (375px mobile, 768px tablet, 1280px desktop):
- Counters
- Tic-Tac-Toe (interact: place X, place O, win the game, restart)
- Todo (add task, search, complete, delete completed)
- 404 (any bad URL)

Confirm:
- No console errors
- No layout breaks at any size
- Animations trigger as designed
- Orange/blue colors appear at meaningful moments
- Brand purple gradient on CounterButton.isMax still works (intentional legacy)

### G5 — Commit cleanup

```bash
git add -A
git commit -m "Final cleanup: prune index.css, confirm no remaining .module.css"
```

---

## Phase H — Wrap up (extends Plan 3's Phase 7)

### H1 — Push and update the existing PR (or open new one if Phase 6 wasn't pushed yet)

```bash
git push -u origin feature/tailwind-shadcn
```

If you already opened a PR for Plan 3's work, this pushes the additional commits to the same branch — the PR picks them up automatically. Update the PR description to mention the additional scope:

```
gh pr edit --body-file - <<'EOF'
## Summary

Introduces Tailwind CSS v4 + shadcn/ui to the project and elevates the entire visual layer:
- All HTML buttons replaced with shadcn Button (with variant overrides for special card-shaped buttons)
- All CSS Modules migrated to Tailwind utility classes — zero feature-level CSS
- Responsive across mobile/tablet/desktop
- Motion system: scale-in for tic-tac-toe placements, pulse for winning cells, slide-in for task additions, pop for counter increments
- Orange + blue theme; brand purple deprecated except for the inherited body gradient

## What changed

- **Foundations**: Tailwind v4 via `@tailwindcss/vite`, shadcn/ui via `npx shadcn init` (Radix/Vega preset). Path aliases (`@/*`) wired in TS + Vite. Theme in `@theme inline` with orange (`--color-primary`) + blue (`--color-secondary`) and motion tokens.
- **Layout/Sidebar/Header**: rewritten to Tailwind, sidebar hides on mobile.
- **Counter**: rewritten to Tailwind, responsive 2/3/4-col grid, increment-pop animation.
- **Todo**: rewritten to Tailwind across all six components, slide-in motion for new tasks.
- **TicTacToe**: full Tailwind rewrite, responsive board (280/360/480), scale-in animation on cell placement, winning-line pulse.
- **404**: migrated to Tailwind.
- **All 14 `.module.css` files deleted** (5 TicTacToe + 3 Layout + 6 Todo). `src/index.css` reduced to ~150 lines of theme + base.
EOF
```

---

## Files summary

| Action | Path | Phase |
|---|---|---|
| Modify | `src/index.css` | A1 (add motion tokens), C4 (prune globals) |
| Modify | `src/layout/Layout/Layout.tsx` | B2 |
| Modify | `src/layout/Sidebar/Sidebar.tsx` | B3 |
| Modify | `src/layout/Header/Header.tsx` | B4 |
| Delete | `src/layout/{Layout,Sidebar,Header}/*.module.css` | B5 |
| Modify | `src/features/counter/CounterApp.tsx` | C2 |
| Modify | `src/features/counter/CounterButton/CounterButton.tsx` | C3 |
| Modify | `src/features/todo/TodoPage.tsx` | D2 |
| Modify | `src/features/todo/components/AddTaskForm/AddTaskForm.tsx` | D3 |
| Modify | `src/features/todo/components/SearchBar/SearchBar.tsx` | D4 |
| Modify | `src/features/todo/components/TaskStats/TaskStats.tsx` | D5 |
| Modify | `src/features/todo/components/TaskList/TaskList.tsx` | D6 |
| Modify | `src/features/todo/components/TaskList/TaskItem/TaskItem.tsx` | D7 |
| Delete | `src/features/todo/**/*.module.css` (6 files) | D8 |
| Modify | `src/pages/NotFoundPage.tsx` | E1 |
| Modify | `src/features/tic-tac-toe/Board/Board.tsx` | F1 |
| Modify | `src/features/tic-tac-toe/Square/Square.tsx` | F2, F3 |
| Modify | `src/features/tic-tac-toe/TicTacToe.tsx` | F4 (only if MoveHistory overflows mobile) |

---

## What this plan does NOT include

Deliberate scope discipline (per "stick to assignment requirements"):
- **No light-mode toggle.** Dark only. The `.dark` block exists; toggling it is a future plan.
- **No new pages or routes.** We're polishing existing surface area.
- **No design system documentation file.** The plan itself documents intent; we ship code, not Storybook.
- **No theme palette additions.** Orange + blue stay. We use shadcn's existing `--destructive`, `--muted`, etc. unchanged.
- **No PR description rewrite for Plan 3's portion.** We extend the existing description; we don't relitigate Phase 1-6 wording.

If you want any of those after Plan 4 ships, they're their own plan.
