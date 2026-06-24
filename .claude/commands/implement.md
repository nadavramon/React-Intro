---
description: SDD pipeline step 3 — execute a plan's checkbox tasks via fan-out subagents, ticking each off
argument-hint: '[task range, e.g. 3-5]'
allowed-tools: Bash(npm run lint), Bash(npm run test:run), Bash(tsc -b)
---

You are running **/implement**, step 3 of the spec-driven pipeline (see `CLAUDE.md → "Spec-driven workflow"`). This phase **fans execution out to subagents** so implementation noise never pollutes this session.

1. **Resolve the plan (ambiguity guard):**
    - If `$ARGUMENTS` leads with a topic slug, use the matching `docs/superpowers/plans/*<slug>*-plan.md` — a slug always wins (a bare range like `1-3` is **not** a slug).
    - Otherwise read `docs/superpowers/INDEX.md` and treat features with status `Planned` or `In progress` as candidates. **0** → stop ("no plan is ready — run `/plan` first"). **Exactly 1** → use it. **2 or more** → refuse; list the candidate slugs and ask the user to re-run `/implement <slug> <range>`. Never fall back to file mtime.
    - State which plan you picked (or why you stopped).
2. Parse its `- [ ]` checkbox tasks. **Select** tasks from a range in `$ARGUMENTS` (e.g. `3-5`, `2-`); if no range is given, take all unchecked tasks.
3. For **each selected task, in order**, build the subagent dispatch from its equipment tags, then dispatch a **foreground** subagent:
    - `**Agent:**` → `subagent_type` (default `general-purpose`).
    - `**Model:**` → `model` override (omit to inherit).
    - `**Skills:**` → tell the subagent: "Use these skills, in order: <list>." **Always prepend the test-driven-development baseline**, even when no skills are tagged.
    - Pass only that task's steps + the plan path. The subagent implements, then runs the relevant check (`npm run test:run`, `tsc -b`, or `npm run lint` as fits the task).
    - **Guards:** if a `**Skills:**` value names a skill that isn't installed, note it in the digest + JOURNAL and continue without it (don't hard-fail). If `**Agent:** Explore` is set on a task that produces code, stop and surface the mismatch — Explore can't write.
4. After each task returns:
    - Tick its box (`- [ ]` → `- [x]`) in the plan file.
    - Append `## <timestamp> — implement task N: <title>` to `docs/superpowers/JOURNAL.md` — what changed, key decisions, deviations, check result (pass/fail), and the chosen equipment (e.g. `task 4 → general-purpose / opus + typescript-advanced-types`).
    - Report a **tight digest** to the user: files touched · key decisions · chosen equipment · open questions · suggested next step. (Full detail is in the plan + journal.)
5. If a task's check **fails**, stop and surface it — do **not** tick the box. The user decides whether to fix or rerun.
6. When the selected range is done, update `docs/superpowers/INDEX.md` status (`In progress`, or `Done` once all boxes are ticked).

Rerunnable: state lives in the checkboxes, so `/clear` then `/implement <N->` resumes from disk.
