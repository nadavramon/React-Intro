# Resolver Ambiguity Guard — Implementation Plan

> **For agentic workers:** implement task-by-task. The targets are two command markdown files, so verification is **re-read + behavioral**, not unit tests.

**Goal:** Replace the unsafe "most-recently-modified file" resolution in `/plan` and `/implement` with an INDEX-status ambiguity guard: slug always wins; else act only when exactly one feature is a candidate, otherwise refuse and ask for a slug.

**Architecture:** Edit step 1 of each command. Candidate set comes from `docs/superpowers/INDEX.md` status column (`/plan` → `Spec'd`; `/implement` → `Planned`/`In progress`). No mtime fallback.

**Tech Stack:** Markdown command files under `.claude/commands/` (tracked/committable).

**Spec:** `docs/superpowers/specs/2026-06-24-resolver-ambiguity-guard-design.md`

**No equipment tags** on these tasks — plain markdown edits, default path (sparse rule).

---

### Task 1: Replace plan.md step 1 with the ambiguity guard

**Files:**
- Modify: `.claude/commands/plan.md` (step 1, "Resolve the spec")

- [x] **Step 1: Replace the step-1 block** with:

```markdown
1. **Resolve the spec (ambiguity guard):**
   - If `$ARGUMENTS` names a topic slug, use the matching `docs/superpowers/specs/*<slug>*-design.md` — a slug always wins.
   - Otherwise read `docs/superpowers/INDEX.md` and treat features with status `Spec'd` as candidates. **0** → stop ("nothing is `Spec'd` — run `/specify` first"). **Exactly 1** → use it. **2 or more** → refuse; list the candidate slugs and ask the user to re-run `/plan <slug>`. Never fall back to file mtime.
   - State which spec you picked (or why you stopped).
```

- [x] **Step 2: Verify** — re-read; step 1 now describes slug-wins + Spec'd-candidate counting (0/1/2+), no mtime. Commit.

---

### Task 2: Replace implement.md step 1 with the ambiguity guard

**Files:**
- Modify: `.claude/commands/implement.md` (step 1, "Resolve the plan")

- [x] **Step 1: Replace the step-1 block** with:

```markdown
1. **Resolve the plan (ambiguity guard):**
   - If `$ARGUMENTS` leads with a topic slug, use the matching `docs/superpowers/plans/*<slug>*-plan.md` — a slug always wins (a bare range like `1-3` is **not** a slug).
   - Otherwise read `docs/superpowers/INDEX.md` and treat features with status `Planned` or `In progress` as candidates. **0** → stop ("no plan is ready — run `/plan` first"). **Exactly 1** → use it. **2 or more** → refuse; list the candidate slugs and ask the user to re-run `/implement <slug> <range>`. Never fall back to file mtime.
   - State which plan you picked (or why you stopped).
```

- [x] **Step 2: Verify** — re-read; step 1 now counts `Planned`/`In progress` candidates and treats a bare range as not-a-slug. Steps 2-6 untouched. Commit.

---

### Task 3: Verify end-to-end + format

- [x] **Step 1:** `npx prettier --check ".claude/commands/plan.md" ".claude/commands/implement.md"` → green (run `--write` if needed; Prettier owns formatting).
- [x] **Step 2 (behavioral):** with two features `Planned` (e.g. subagent-task-equipment + todo-search-debounce), confirm a bare `/implement 2-` would now refuse + list slugs, while `/implement <slug> 2-` resolves directly. (Reasoned check — no automated harness for command prompts.)

---

## Verification

- Per-task: re-read the changed step.
- `npx prettier --check` on both files stays green.
- End-to-end is the guard's own behavior (Task 3 step 2): ambiguous → refuse + list; single → act; slug → always direct.

## Notes

- Both files are tracked (`.claude/commands/` is committable, unlike `.claude/skills/`). Commit per task on `chore/sdd-command-pipeline`.
- This is the fix for the near-miss that occurred during the subagent-task-equipment dogfood; once shipped, `/implement` and `/plan` fail safe instead of guessing by mtime.
