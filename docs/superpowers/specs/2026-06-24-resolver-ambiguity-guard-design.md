# Resolver Ambiguity Guard — Design

**Date:** 2026-06-24
**Status:** Spec'd

## Problem

`/plan` and `/implement` resolve their target by "most-recently-modified file" when no slug is given. With more than one feature in flight, that silently picks the wrong one. **Real incident:** during the subagent-task-equipment dogfood, bare `/implement 1-3` would have grabbed `todo-search-debounce` (its plan file was 9 seconds newer, written by a parallel session) instead of the intended `subagent-task-equipment`. It was caught only by manually checking mtimes. Mtime is the wrong disambiguator — recency of a file write has nothing to do with which feature the user means.

## Goal

Make bare (slug-less) `/plan` and `/implement` **safe under concurrency**: act automatically only when there is exactly one sensible target; otherwise refuse and ask for a slug. An explicit slug always wins.

## Approach: ambiguity guard via INDEX status

Use `docs/superpowers/INDEX.md` (which the pipeline already maintains) as the source of truth, not file mtime. Status legend is `Spec'd → Planned → In progress → Done`.

**Candidate set per command:**
- `/plan` → features with status **`Spec'd`** (have a spec, not yet planned).
- `/implement` → features with status **`Planned`** or **`In progress`** (have a plan, not yet done).

**Resolution rule (both commands):**
1. If a **slug** is given, use the matching artifact directly — bypass the guard entirely. Explicit always wins, even when statuses are ambiguous.
2. Else count candidates (per the set above):
   - **0 candidates** → stop with a clear message ("no feature is `Spec'd`/`Planned` — run the prior step first"). Do not fall back to mtime.
   - **exactly 1** → use it. State which feature you picked.
   - **2 or more** → **refuse**; list the candidate slugs and ask the user to re-run with one. Do not guess by mtime.

This blocks only when genuinely ambiguous; the common single-active-feature case stays zero-friction.

## File changes

| File | Change |
| --- | --- |
| `.claude/commands/plan.md` | Replace step 1's "most-recently-modified spec" resolution with: slug overrides; else candidates = INDEX rows with status `Spec'd`; 0 → stop, 1 → use, 2+ → refuse + list slugs. |
| `.claude/commands/implement.md` | Replace step 1's "most-recently-modified plan" resolution with the same rule; candidates = INDEX rows with status `Planned` or `In progress`. |

No changes to `writing-plans`, the artifact formats, or INDEX/JOURNAL structure — this only changes how the two commands *choose* a target.

## Edge cases

- **Feature missing from INDEX** → not a candidate. INDEX is the maintained source of truth; a plan/spec on disk but absent from INDEX won't be auto-picked (a slug still reaches it directly).
- **Stale INDEX status** (e.g. a row left `Planned` after completion) → could count as a false candidate, at worst forcing a slug prompt. Fails safe (asks) rather than acting wrong. The `/implement` "mark `Done`" step already keeps status current.
- **Range without slug** (`/implement 1-3`) → the range is not a slug; the guard runs normally on the candidate set.

## Verification

Behavioral:
1. Two features both `Planned` → bare `/implement 2-` refuses and lists both slugs. With a slug, it proceeds.
2. Exactly one feature `Planned` → bare `/implement` works and states the pick.
3. No feature `Spec'd` → bare `/plan` stops with the "run /specify first" message.
4. `/plan <slug>` and `/implement <slug> <range>` always resolve directly regardless of how many features are active.
