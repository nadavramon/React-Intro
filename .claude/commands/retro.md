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
