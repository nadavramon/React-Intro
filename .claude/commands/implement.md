---
description: SDD pipeline step 3 — execute a plan's checkbox tasks via fan-out subagents, ticking each off
argument-hint: "[task range, e.g. 3-5]"
allowed-tools: Bash(npm run lint), Bash(npm run test:run), Bash(tsc -b)
---

You are running **/implement**, step 3 of the spec-driven pipeline (see `CLAUDE.md → "Spec-driven workflow"`). This phase **fans execution out to subagents** so implementation noise never pollutes this session.

1. **Resolve the plan:** if `$ARGUMENTS` leads with a topic slug, use the matching `docs/superpowers/plans/*<slug>*-plan.md`; otherwise the most-recently-modified file in `docs/superpowers/plans/`. State which plan you picked.
2. Parse its `- [ ]` checkbox tasks. **Select** tasks from a range in `$ARGUMENTS` (e.g. `3-5`, `2-`); if no range is given, take all unchecked tasks.
3. For **each selected task, in order**, dispatch a **foreground** subagent (`general-purpose`):
   - Give it only that task's steps + the plan path + "follow the test-driven-development skill."
   - It implements, then runs the relevant check (`npm run test:run`, `tsc -b`, or `npm run lint` as fits the task).
4. After each task returns:
   - Tick its box (`- [ ]` → `- [x]`) in the plan file.
   - Append `## <timestamp> — implement task N: <title>` to `docs/superpowers/JOURNAL.md` — what changed, key decisions, deviations, check result (pass/fail).
   - Report a **tight digest** to the user: files touched · key decisions · open questions · suggested next step. (Full detail is in the plan + journal.)
5. If a task's check **fails**, stop and surface it — do **not** tick the box. The user decides whether to fix or rerun.
6. When the selected range is done, update `docs/superpowers/INDEX.md` status (`In progress`, or `Done` once all boxes are ticked).

Rerunnable: state lives in the checkboxes, so `/clear` then `/implement <N->` resumes from disk.
