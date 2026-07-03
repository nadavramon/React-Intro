# Subagent Task Equipment — Design

**Date:** 2026-06-24
**Status:** Spec'd

## Problem

`/implement` fans each plan task out to a subagent, but every subagent is dispatched the same way: `general-purpose`, default model, only the TDD baseline. A task that needs `systematic-debugging`, `typescript-advanced-types`, or a read-only `Explore` agent gets none of that unless the model happens to pick it. We want each task to **declare the right equipment** so `/implement` dispatches the best-suited subagent deterministically.

## Decisions (from brainstorming)

1. **Plan declares.** `/plan` writes equipment tags per task; `/implement` reads and obeys. Deterministic, reviewable before execution, editable in the plan. Fits the pipeline's "decisions live on disk" philosophy.
2. **Convention lives in the `writing-plans` skill.** Tags become part of the task template itself. `writing-plans` here is **project-local** (`.claude/skills/writing-plans/`), so the blast radius is this repo only.

## Tag syntax

Three optional inline fields per task block, matching the existing `**Files:**` style:

```markdown
### Task 4: Type-safe Link wrapper
**Files:**
- Create: `src/routes/__root.tsx`
**Skills:** typescript-advanced-types
**Agent:** general-purpose
**Model:** opus
- [ ] Step 1: …
```

**Sparse rule:** add a field only when it changes behavior from the default. Boilerplate tasks carry no tags. Tags stay meaningful, plans stay clean.

| Field | Values | Default |
| --- | --- | --- |
| `**Skills:**` | comma list of installed skill names, in suggested order | none beyond the TDD baseline |
| `**Agent:**` | `general-purpose` / `Explore` / `Plan` | `general-purpose` |
| `**Model:**` | `opus` / `sonnet` / `haiku` | omit (inherit) |

## Produce side — `writing-plans` SKILL.md

- Extend the task template (the `### Task N` structure) with the three optional fields + a one-line "only when it helps."
- Add a **skill→task heuristic** block so plans equip tasks consistently:
  - UI / visual → `frontend-design`, `impeccable`
  - bug / unexpected behavior → `systematic-debugging`
  - complex types → `typescript-advanced-types`
  - React/Next perf → `vercel-react-best-practices`
  - reviewing prior output → `receiving-code-review`
  - **baseline for every code task → `test-driven-development`** (implicit, not tagged)
- Extend its self-review checklist: "tags reference real installed skills; `**Agent:**` is write-capable for any task that produces code."

## Consume side — `implement.md`

For each selected task, parse the three fields and build the dispatch:

- `**Agent:**` → `subagent_type` (default `general-purpose`).
- `**Model:**` → `model` override (default: omit → inherit).
- `**Skills:**` → inject "Use these skills, in order: X, Y" into the subagent prompt; **always prepend the TDD baseline**.
- After dispatch, record the **chosen equipment** in the per-task digest and the JOURNAL entry, e.g. `task 4 → general-purpose / opus + typescript-advanced-types`. Equipment is visible (digest) and durable (journal), so a wrong choice is debuggable.

## Guards + defaults

- **Unknown skill** named in a tag → flag it in the digest + JOURNAL and continue without it. Do not hard-fail (learning-friendly; a typo shouldn't block the run).
- **`Explore` agent** can Read but not Edit/Write → reject it for any task that produces code; allow only for read-only research tasks. `/implement` surfaces the mismatch instead of dispatching a subagent that can't do the work.
- All three fields optional; absent → the defaults above.

## Out of scope (YAGNI)

- Tags reference **existing** skills only. No authoring new skills mid-run — `writing-skills` remains a separate, manual act for when a reusable capability is genuinely missing.
- No per-task arbitrary tool allowlists. Tool access comes from the agent type (`general-purpose` = all tools). Only Skills / Agent / Model are tunable per task.

## Files touched

- `.claude/skills/writing-plans/SKILL.md` — template fields + heuristic + self-review (produce).
- `.claude/commands/implement.md` — parse + dispatch + logging + guards (consume).
- `CLAUDE.md` — one-line pointer in the SDD section that tasks carry equipment tags.

## Verification

Dogfood: annotate one task in the **tanstack-router** plan (the type-safe `Link` task → `**Skills:** typescript-advanced-types`), run `/implement` on that task, and confirm (a) the foreground subagent is dispatched with that skill, and (b) the JOURNAL entry records the chosen equipment. Also verify an untagged task still dispatches with the `general-purpose` + TDD-baseline defaults.
