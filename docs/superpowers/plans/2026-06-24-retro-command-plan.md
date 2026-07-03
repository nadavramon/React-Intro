# Retro Command — Implementation Plan

> **For agentic workers:** implement task-by-task. Targets are prompt/markdown files, so verification is **re-read + behavioral dogfood**, not unit tests.

**Goal:** Add `/retro <feature>`, the 4th pipeline command — a retrospective that turns a completed feature's mistakes into durable, forward-feeding changes (tooling edits / memory / a LESSONS log), behind an approval gate.

**Architecture:** A live command (review dialogue, stays in main). Reads the feature's JOURNAL/plan/spec/diff; extracts the highest-leverage few lessons; routes each to its home; always writes a `LESSONS.md` entry; applies tooling/memory changes only after approval. `/implement` suggests it at Done.

**Spec:** `docs/superpowers/specs/2026-06-24-retro-command-design.md`

**No equipment tags** — plain markdown edits, default path.

---

### Task 1: Write the `/retro` command

**Files:**
- Create: `.claude/commands/retro.md`

- [x] **Step 1: Create `.claude/commands/retro.md`** with exactly:

````markdown
---
description: SDD pipeline step 4 — retrospective on a completed feature; route lessons into tooling/memory/log
argument-hint: "<feature-slug>"
---

You are running **/retro**, the learning step of the spec-driven pipeline (see `CLAUDE.md → "Spec-driven workflow"`). Stay **live in this session** — this is a review you steer.

Purpose: turn a completed feature's mistakes into durable, forward-feeding changes so the next pipeline run is sharper. **Be ruthless** — surface only lessons that change future behavior; do not narrate what happened. A clean feature can yield zero proposals, and that is a successful retro.

1. **Resolve the feature (ambiguity guard):** if `$ARGUMENTS` names a slug, use it; otherwise read `docs/superpowers/INDEX.md` and take features with status `Done` as candidates. **0** → stop ("nothing is `Done` to retro"). **1** → use it. **2+** → refuse; list the candidate slugs and ask for `/retro <slug>`. State the feature.
2. **Gather material:** read the feature's `docs/superpowers/JOURNAL.md` entries (especially the `deviations` and `check result` fields), its plan (planned steps vs. what the journal says happened), its spec (original intent), and the feature's commits (`git log` / `git diff`) to catch drift between plan and reality.
3. **Extract lessons** — the highest-leverage few only. For each: a one-line statement plus the **root cause** (why it happened, not just what).
4. **Classify + route** each lesson into exactly one home:
   - **Recurring process gap** (a missing check or step would have prevented it) → a concrete proposed edit to the relevant command or skill file (e.g., a `writing-plans` self-review check, an `implement.md` step).
   - **Durable cross-session gotcha or preference** (useful beyond this feature, not already in the repo) → a proposed `memory/` file (feedback/reference) plus its `MEMORY.md` pointer.
   - **One-off / already fixed** → `LESSONS.md` only.
5. **Write the log entry** (always) to `docs/superpowers/LESSONS.md` (append, reverse-chronological): `## <date> — retro: <feature>` with **Worked**, **Went wrong (+ root cause)**, **Lessons (routed)**.
6. **Present the routed proposals as a checklist and STOP for approval.** Apply NOTHING — no tooling edit, no memory write — without the user's OK. On approval, apply the approved tooling edits and write the approved memory files (with `MEMORY.md` pointers).
7. **Append** a `## <timestamp> — retro: <feature>` entry to `docs/superpowers/JOURNAL.md` summarizing the lessons and which proposals were applied.
````

- [x] **Step 2: Verify** — re-read; the command resolves a feature, gathers material, routes lessons, gates on approval, and always logs. Commit. *(deferred to Task 5)*

---

### Task 2: Create the LESSONS log

**Files:**
- Create: `docs/superpowers/LESSONS.md`

- [ ] **Step 1: Create `docs/superpowers/LESSONS.md`:**

```markdown
# SDD Lessons

Append-only, reverse-chronological. Each `/retro` run records what to do better next time.
Recurring lessons graduate into tooling changes (command/skill edits) or memory; the rest live here as the running record.

Entry format: `## <date> — retro: <feature>` → **Worked** / **Went wrong (+ root cause)** / **Lessons (routed: tooling | memory | log)**.

---
```

- [ ] **Step 2: Verify** — re-read. (Gitignored under `docs/`, like INDEX/JOURNAL — local-only.)

---

### Task 3: Wire the Done-time suggestion into `/implement`

**Files:**
- Modify: `.claude/commands/implement.md` (step 6)

- [ ] **Step 1:** Step 6 currently updates INDEX status. Append to it: "When a feature reaches `Done` (all boxes ticked), suggest the user run `/retro <feature>` to capture lessons before moving on — a suggestion, not a forced step."
- [ ] **Step 2: Verify** — re-read; step 6 now nudges `/retro` at Done. Commit.

---

### Task 4: Document `/retro` in CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (the `## Spec-driven workflow (SDD pipeline)` section)

- [ ] **Step 1:** Add a 4th row to the pipeline table: `| 4 | \`/retro [feature]\` | journal + plan + diff → LESSONS.md + routed tooling/memory changes | review, live in main |`.
- [ ] **Step 2:** Add a bullet: "After a feature is `Done`, `/retro` turns its mistakes into tooling/memory changes (approval-gated) so the pipeline itself gets sharper — `docs/superpowers/LESSONS.md` is the running record."
- [ ] **Step 3: Verify** — re-read the section. Commit.

---

### Task 5: Verify + first real retro (dogfood)

- [ ] **Step 1:** `npx prettier --check ".claude/commands/retro.md" ".claude/commands/implement.md" "CLAUDE.md"` → green (`--write` if needed).
- [ ] **Step 2 (dogfood):** Run `/retro tanstack-router` on this session's just-completed feature. Confirm it (a) writes a `LESSONS.md` entry, (b) proposes routed changes — expected: the gen-file-path lesson → a `writing-plans` check; the commit-heredoc + gitignore lessons → memory — and (c) applies nothing without approval.
- [ ] **Step 3 (clean-case check):** Confirm a low-friction feature (e.g. `resolver-ambiguity-guard`) yields few/zero proposals — proving the anti-bloat rule holds.

---

## Verification

- Per-task: re-read the changed file.
- `npx prettier --check` on the three tracked files stays green.
- End-to-end: Task 5's dogfood — a real `/retro` run produces a LESSONS entry + routed, approval-gated proposals, and a clean feature produces near-zero.

## Notes

- Tracked/committable: `retro.md`, `implement.md`, `CLAUDE.md`. Gitignored (local): `LESSONS.md`, and any memory files (`~/.claude/.../memory/`).
- Commit the tracked files per task on a fresh branch off `main` (the SDD-pipeline and tanstack PRs are separate); confirm branch with Nadav.
