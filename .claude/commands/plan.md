---
description: SDD pipeline step 2 — turn a design spec into a committed, checkbox-task implementation plan
argument-hint: '[topic-slug]'
---

You are running **/plan**, step 2 of the spec-driven pipeline (see `CLAUDE.md → "Spec-driven workflow"`). Stay **live in this session** — you steer the plan with the user.

1. **Resolve the spec (ambiguity guard):**
    - If `$ARGUMENTS` names a topic slug, use the matching `docs/superpowers/specs/*<slug>*-design.md` — a slug always wins.
    - Otherwise read `docs/superpowers/INDEX.md` and treat features with status `Spec'd` as candidates. **0** → stop ("nothing is `Spec'd` — run `/specify` first"). **Exactly 1** → use it. **2 or more** → refuse; list the candidate slugs and ask the user to re-run `/plan <slug>`. Never fall back to file mtime.
    - State which spec you picked (or why you stopped).
2. **Enter plan mode** (EnterPlanMode), read the spec, and develop the implementation plan interactively — the user steers it. Read-only safety comes for free.
    - _Fallback:_ if entering plan mode from a command misbehaves, instead do read-only research, present the plan inline for approval, then continue. The artifact is identical either way.
3. Use the **writing-plans** skill for structure and quality: required header, file map, bite-sized `- [ ]` TDD steps, exact paths, frequent commits.
4. **Override writing-plans' execution handoff:** do **not** offer subagent-driven / inline execution at the end — `/implement` owns execution.
5. On approval, persist to `docs/superpowers/plans/YYYY-MM-DD-<topic>-plan.md` (reuse the spec's date + slug).
6. Update `docs/superpowers/INDEX.md` (Plan linked, Status `Planned`) and append `## <timestamp> — plan: <topic>` to `docs/superpowers/JOURNAL.md`.
7. Tell the user: plan committed at `<path>`. Run `/implement` next (optionally `/implement <N-M>`).
