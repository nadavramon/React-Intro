# Retro Command — Design

**Date:** 2026-06-24
**Status:** Spec'd

## Problem

The SDD pipeline (`/specify → /plan → /implement`) builds features but never *learns* from how a build went. Mistakes recur because lessons live only in a finished session's context and evaporate. This session alone produced repeatable lessons — a generated-file path assumed instead of verified, a near-miss from mtime-based resolution, commit-message heredoc breakage, gitignore surprises discovered mid-flow. None of these would auto-prevent a repeat. We want a habit: after a feature completes, run a retrospective that turns mistakes into durable, **forward-feeding** changes so the next pipeline run is sharper.

## Goal

A 4th pipeline command, **`/retro <feature>`**, that reviews a completed feature and routes each lesson to the home where it will actually change future behavior. A retro is worthless if it only logs; the value is the feed-forward.

## Decisions (from brainstorming)

1. **Feed-forward = route to the right home.** Each lesson becomes a concrete proposed change (tooling edit / memory / log), applied only after user approval.
2. **Trigger = `/retro <feature>` command, prompted at Done.** `/implement` suggests it when a feature's last box ticks. Explicit, skippable for trivial work, fits the pipeline.

## How it works

### Reads (the substrate already exists)
- The feature's **`JOURNAL.md`** entries — especially the `deviations` and `check result` fields, where friction is already recorded.
- The **plan** (planned steps vs. what the journal says happened) and the **spec** (original intent).
- The **git diff / log** for the feature's commits — surfaces drift between plan and reality.

### Produces
1. **A `docs/superpowers/LESSONS.md` entry** (always) — append-only, per-feature: what went wrong, what worked, root causes. The durable record. Gitignored, like the other `docs/` artifacts.
2. **Routed proposals** — each lesson is classified and turned into a concrete change:
   - **Recurring process gap** → propose an edit to the relevant command or skill file (e.g., a new check in the `writing-plans` self-review, a step in `implement.md`). This is how the pipeline itself gets smarter.
   - **Durable cross-session preference or gotcha** → propose a `memory/` feedback/reference file (with the MEMORY.md pointer).
   - **One-off / project-specific fact already fixed** → stays in `LESSONS.md` only.
3. **Approval gate** — proposals are presented as a checklist; nothing is applied (no tooling edit, no memory write) without the user's OK.

### Routing heuristic (baked into the command)
- Did the mistake stem from a missing check or step in the tooling? → **tooling fix**.
- Would the lesson help across sessions/projects and isn't already in the repo? → **memory**.
- Is it specific to this feature and already resolved by the fix? → **log only**.

### Trigger wiring
`implement.md` step 6 gains one line: when the selected range completes a feature (all boxes ticked, status → `Done`), suggest running `/retro <feature>`. It is a suggestion, not a forced step.

## Anti-bloat (a hard requirement)

The retro must be ruthless — only surface lessons that change future behavior. No "we did X" narration, no restating what the JOURNAL already says. **A clean run can legitimately yield zero proposals, and that is a successful retro.** Cap output at the highest-leverage few lessons rather than an exhaustive list.

## Files

- **New:** `.claude/commands/retro.md` (the command), `docs/superpowers/LESSONS.md` (append-only log, gitignored).
- **Modify:** `.claude/commands/implement.md` (the Done-time suggestion), `CLAUDE.md` (document the 4th command in the SDD section).

## Out of scope (YAGNI)

- No automatic application of changes — approval gate is mandatory.
- No metrics/scoring of runs. The retro is qualitative.
- No cross-feature trend analysis in v1 — one feature at a time. (`LESSONS.md` accumulates the history for a human to skim.)

## Verification

Behavioral (prompt files): run `/retro tanstack-router` (and the other just-completed features) as the first real subject. Confirm it (a) writes a `LESSONS.md` entry, (b) proposes routed changes — e.g., the generated-file lesson → a `writing-plans` check ("verify a tool's generated-file path against its default before asserting it"); the commit-heredoc and gitignore lessons → memory — and (c) applies nothing without approval. Confirm a deliberately clean feature yields zero proposals.
