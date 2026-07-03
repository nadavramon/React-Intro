# Subagent Task Equipment — Implementation Plan

> **For agentic workers:** implement task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. NOTE: the targets are prompt/markdown files (a skill + a command + CLAUDE.md), not code — so verification is **re-read + behavioral dogfood**, not red/green unit tests. This mirrors how the SDD pipeline itself was built.

**Goal:** Let each plan task declare its executing subagent's equipment (`**Skills:**`/`**Agent:**`/`**Model:**`) so `/implement` dispatches the best-suited subagent deterministically.

**Architecture:** Plan declares, `/implement` obeys. The tag convention is baked into the project-local `writing-plans` skill (produce side); `implement.md` parses + dispatches (consume side); CLAUDE.md gets a one-line pointer. Tags are optional and sparse — absent fields fall back to `general-purpose` / inherited model / TDD baseline.

**Tech Stack:** Markdown prompt files under `.claude/`. No runtime deps.

**Spec:** `docs/superpowers/specs/2026-06-24-subagent-task-equipment-design.md`

**Note on this plan's own tasks:** per the sparse rule, these are straightforward markdown edits needing no special skill — so they carry **no** equipment tags. That absence is itself the demo of the default path.

---

### Task 1: Add equipment fields to the writing-plans task template

**Files:**
- Modify: `.claude/skills/writing-plans/SKILL.md` (the `## Task Structure` fenced `### Task N` template, ~lines 65-104)

- [x] **Step 1: Insert the three optional fields after the `**Files:**` block** in the task template, so generated tasks show them:

```markdown
**Skills:** <comma list, in order — only when a skill beyond the TDD baseline helps>
**Agent:** <general-purpose | Explore | Plan — omit for the default, general-purpose>
**Model:** <opus | sonnet | haiku — omit to inherit the session model>
```

- [x] **Step 2: Add a one-line sparse note** immediately under the template: "Equipment fields are optional — add one only when it changes behavior from the default. Boilerplate tasks carry none."

- [x] **Step 3: Verify** — re-read the section; the template shows the three fields with the sparse note. Commit.

---

### Task 2: Add the "Task Equipment" reference section to writing-plans

**Files:**
- Modify: `.claude/skills/writing-plans/SKILL.md` (new section directly after `## Task Structure`)

- [x] **Step 1: Add a `## Task Equipment` section** with the field table and the skill→task heuristic:

```markdown
## Task Equipment

Each task may declare how `/implement` should dispatch its subagent. All optional; sparse.

| Field | Values | Default |
| --- | --- | --- |
| `**Skills:**` | comma list of installed skill names, in suggested order | none beyond the TDD baseline |
| `**Agent:**` | `general-purpose` / `Explore` / `Plan` | `general-purpose` |
| `**Model:**` | `opus` / `sonnet` / `haiku` | omit (inherit) |

**Skill→task heuristic** (pick the skill that fits the task's nature):
- UI / visual → `frontend-design`, `impeccable`
- bug / unexpected behavior → `systematic-debugging`
- complex types → `typescript-advanced-types`
- React / Next perf → `vercel-react-best-practices`
- reviewing prior output → `receiving-code-review`
- every code task (baseline, implicit — do not tag) → `test-driven-development`

`**Agent:** Explore` is read-only (no Edit/Write); never use it for a task that produces code.
```

- [x] **Step 2: Verify** — re-read; table + heuristic present and consistent with the template from Task 1. Commit.

---

### Task 3: Extend the writing-plans self-review checklist

**Files:**
- Modify: `.claude/skills/writing-plans/SKILL.md` (the `## Self-Review` list, ~lines 122-132)

- [x] **Step 1: Add a fourth self-review check:**

```markdown
**4. Equipment tags:** Every `**Skills:**` value names an installed skill (no typos). Every task that produces code uses a write-capable `**Agent:**` (not `Explore`). Remove tags that merely restate the default.
```

- [x] **Step 2: Verify** — re-read; the new check reads cleanly alongside the existing three. Commit.

---

### Task 4: Teach implement.md to parse + dispatch equipment

**Files:**
- Modify: `.claude/commands/implement.md` (step 3, the per-task subagent dispatch)

- [x] **Step 1: Replace step 3's dispatch bullet** so it parses the tags and builds the dispatch:

```markdown
3. For **each selected task, in order**, build the subagent dispatch from its equipment tags, then dispatch a **foreground** subagent:
   - `**Agent:**` → `subagent_type` (default `general-purpose`).
   - `**Model:**` → `model` override (omit to inherit).
   - `**Skills:**` → tell the subagent: "Use these skills, in order: <list>." **Always prepend the test-driven-development baseline**, even when no skills are tagged.
   - Pass only that task's steps + the plan path. The subagent implements, then runs the relevant check (`npm run test:run`, `tsc -b`, or `npm run lint` as fits the task).
```

- [x] **Step 2: Verify** — re-read implement.md; step 3 now reads tags and constructs subagent_type/model/skills with the TDD baseline always present. Commit.

---

### Task 5: Add guards + equipment logging to implement.md

**Files:**
- Modify: `.claude/commands/implement.md` (step 4 reporting + a new guards note)

- [x] **Step 1: Add equipment to the per-task logging** in step 4 — the JOURNAL entry and digest record the chosen equipment, e.g. `task 4 → general-purpose / opus + typescript-advanced-types`.

- [x] **Step 2: Add a guards bullet** before the dispatch:

```markdown
- **Guards:** if a `**Skills:**` value names a skill that isn't installed, note it in the digest + JOURNAL and continue without it (don't hard-fail). If `**Agent:** Explore` is set on a task that produces code, stop and surface the mismatch — Explore can't write.
```

- [x] **Step 3: Verify** — re-read; guards + equipment logging present. Commit.

---

### Task 6: Add the CLAUDE.md pointer

**Files:**
- Modify: `CLAUDE.md` (the `## Spec-driven workflow (SDD pipeline)` section)

- [x] **Step 1: Add one bullet** to the SDD section: "Plan tasks may carry `**Skills:**`/`**Agent:**`/`**Model:**` equipment tags; `/implement` dispatches each task's subagent accordingly (see the `writing-plans` skill)."

- [x] **Step 2: Verify** — re-read the section; pointer reads cleanly. Commit.

---

### Task 7: Behavioral dogfood

**Files:**
- Depends on: `docs/superpowers/plans/2026-06-24-tanstack-router-plan.md` (created later via `/plan tanstack-router`)

- [ ] **Step 1:** In the tanstack-router plan, tag the type-safe `Link` wrapper task with `**Skills:** typescript-advanced-types`.
- [ ] **Step 2:** Run `/implement <that task #>`; confirm the foreground subagent is dispatched **with** `typescript-advanced-types`, and the JOURNAL entry records the equipment.
- [ ] **Step 3:** Confirm an **untagged** task still dispatches with `general-purpose` + the TDD baseline (the default path).

---

## Verification

- **Per-task:** after each edit, re-read the changed section (no unit tests apply to prompt markdown).
- **Format:** `npm run format:check` stays green (Prettier owns `.md`); fix with `npm run format` if needed.
- **End-to-end:** Task 7 is the behavioral proof — a tagged task reaches its subagent equipped, an untagged task uses defaults, and equipment is visible in the JOURNAL.

## Notes

- These artifacts live under `.claude/` (tracked) except the dogfood's plan/journal under gitignored `docs/`. The `writing-plans`, `implement.md`, and `CLAUDE.md` edits **are** committable.
- Commit per task on the current `chore/sdd-command-pipeline` branch (or a fresh branch if Nadav prefers to isolate this from the SDD-pipeline commit).
