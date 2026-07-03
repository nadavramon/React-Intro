# SDD Command Pipeline — Design

**Date:** 2026-06-24
**Status:** Approved

## Problem

The `.claude/` infra already practices spec-driven development — the `brainstorming` and `writing-plans` skills write artifacts into `docs/superpowers/`. But the workflow is **implicit**: a skill fires only when the model judges it relevant, the working plan lives in the conversation, and there is no rerunnable entry point. When a session's context grows long ("context rot"), that in-conversation state degrades and there's no clean way to resume.

## Goals

1. **Avoid context rot** — keep phase state on disk so each step reloads a tight, relevant slice instead of dragging the whole conversation.
2. **One obvious command flow I can rerun** — explicit `/commands` that survive `/clear`.

These are not in tension: the rerunnable command flow *is* the anti-rot mechanism. Each command reads the prior artifact, writes its own, and is rerunnable — so if context rots, `/clear` + rerun reloads from disk. **Rerunnable = context-rot-survivable.**

## Alternatives considered

- **Vercel eve** — a framework for building and *deploying* production agents (Slack/Discord bots, durable workflows, sandboxed compute). Wrong layer: it ships an agent product; this repo is a learning sandbox with no agent to ship. **Not adopted.**
- **GitHub Spec Kit** — a spec-driven-development toolkit (`specify` CLI installing `/speckit.*` commands). Right idea, but it duplicates the `brainstorming` + `writing-plans` skills already in this repo. Adopting it would create two competing spec systems. **Not adopted — read for ideas only.**
- **Chosen: thin command wrappers over the existing skills**, enforcing an artifact contract + manifest. No new dependency, no second spec system.

## Design

### Pipeline (3 commands)

```
/specify <idea>  → docs/superpowers/specs/<date>-<topic>-design.md   [brainstorming skill, LIVE in main]
/plan [slug]     → docs/superpowers/plans/<date>-<topic>-plan.md     [writing-plans + plan mode, LIVE in main]
/implement [N-M] → code + checks off plan.md boxes + JOURNAL.md      [fan-out subagents, foreground]
```

**Phase-isolation rule:** judgment phases (`/specify`, `/plan`) stay live in the main session — they are dialogues, and a subagent cannot interview the user. Execution (`/implement`) fans out to foreground subagents so implementation noise never pollutes the main context; full output still lands in `plan.md` + `JOURNAL.md`.

### Why 3 and not 5

The whiteboard sketch had `/constitution`, `/specify`, `/plan`, `/tasks`, `/implement`. Reading the skills collapsed it:

- `writing-plans` already emits bite-sized `- [ ]` checkbox tasks, so `plan.md` *is* the task tracker — **no separate `/tasks`**.
- The "constitution" (standing rules every phase inherits) is just `CLAUDE.md`, loaded every session — **document its role, no command**.

### Artifact contract

Reuses the existing flat layout (what the skills already write to), tied together by a manifest:

- `docs/superpowers/specs/<date>-<topic>-design.md` — from `/specify`
- `docs/superpowers/plans/<date>-<topic>-plan.md` — from `/plan`
- `docs/superpowers/INDEX.md` — **manifest**: every feature → spec/plan/status. The discoverability anchor that ties specs↔plans across the two folders.
- `docs/superpowers/JOURNAL.md` — **append-only debug trail**: every command logs what it did. Phase boundaries are debug seams (one file in, one file out → a wrong output tells you which phase to rerun).

### Visibility & debug (mitigating subagent opacity)

Per-phase subagents would otherwise hide work. Mitigations baked in:

- `/implement` subagents run **foreground** — the live action stream is visible; only their *context* is separate.
- Each subagent returns a **structured digest** to main: files touched · key decisions · open questions · suggested next step. Clean summary live; complete record on disk.
- `JOURNAL.md` is the persistent trail for after-the-fact debugging.

## Out of scope

- No eve, no Spec Kit install.
- No migration of existing artifacts beyond backfilling `INDEX.md` rows.
- No new execution engine — `/implement` is native because `superpowers:subagent-driven-development` / `executing-plans` are not installed.

## Verification

Behavioral (these are prompt files): dogfood the pipeline on a throwaway "footer" feature — `/specify` → `/plan` → `/implement 1`, confirm artifacts + INDEX + JOURNAL update, then `/clear` and `/implement 2-` to prove rerun survives context loss. Revert the throwaway feature after.
