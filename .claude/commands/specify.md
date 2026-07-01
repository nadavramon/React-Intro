---
description: SDD pipeline step 1 — turn an idea into a committed design spec via the brainstorming skill
argument-hint: <idea>
---

You are running **/specify**, step 1 of this project's spec-driven pipeline (`/specify → /plan → /implement → /retro`; see `CLAUDE.md → "Spec-driven workflow"`).

Goal: turn `$ARGUMENTS` into a committed design spec. Stay **live in this session** — this phase is a dialogue with the user, not a subagent.

1. Invoke the **brainstorming** skill, scoped to producing a design for: `$ARGUMENTS`.
2. **Override its terminal step:** STOP once the design doc is written to `docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`. Do **not** auto-invoke the writing-plans skill — `/plan` owns that.
3. After the spec is written:
   - Update `docs/superpowers/INDEX.md`: add or refresh this feature's row (Spec linked, Plan `—`, Status `Spec'd`).
   - Append an entry to the top of `docs/superpowers/JOURNAL.md`: `## <timestamp> — specify: <topic>` with one line on what was decided and any open questions.
4. Tell the user: spec committed at `<path>`. Run `/plan` next (optionally `/plan <topic-slug>`).

If `docs/superpowers/INDEX.md` or `JOURNAL.md` don't exist yet, create them following the format documented in `CLAUDE.md`.
