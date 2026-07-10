# README project overview — design

**Date:** 2026-07-10
**Status:** Spec'd

## Problem

`README.md` opens with an accurate project-wide overview (workspace layout, getting started, commands, production shape), but roughly half the file is two assignment-specific Q&A sections ("Design notes" for the monorepo migration and the Google OAuth assignments). A newcomer reading the README learns more about two homework questionnaires than about what the project is and does. The README should describe the overall project; assignment write-ups belong in docs.

## Decision summary

- **Approach:** restructure in place. The existing top half is correct and stays; the assignment Q&A moves out; new project-wide sections are added.
- **Q&A relocation:** move both "Design notes" sections **verbatim** (plus a title and a one-line intro each) into a new `docs/assignments/` folder — nothing is deleted.
- **New content:** app feature tour, dev-services setup, SDD workflow pointer, learning-project framing.

## New README structure

1. **Intro (reframed)** — learning-sandbox framing: started as a React intro exercise, grew into a production-shaped monorepo (SPA + API + shared zod contract); two formerly separate repos unified with history preserved.
2. **What the app does** (new) —
   - Web (`apps/web`): counter, tic-tac-toe, and the main feature — an auth-gated, per-user todo app.
   - Server (`apps/server`): tasks REST API, better-auth (Google OAuth + email/password, cookie sessions), Redis cache-aside for task reads, RabbitMQ welcome-mail queue with Mailpit as the dev SMTP sink, soft-delete task cleanup cron.
3. **Workspace layout** — existing tree block, unchanged.
4. **Getting started** — existing content, plus a new **dev services** subsection: `docker compose up -d` starts Mongo, Redis, RabbitMQ, and Mailpit; note that Redis and RabbitMQ are optional (the server degrades gracefully — no cache / no queued mail).
5. **Commands table** — unchanged.
6. **Production shape** — unchanged.
7. **How this repo is built** (new, short) — the SDD pipeline (`/specify → /plan → /implement → /retro`), with `docs/superpowers/INDEX.md` linked as the feature history/manifest.
8. **Assignment write-ups** — one line linking `docs/assignments/`.

## File moves

| From (README section) | To |
| --- | --- |
| "Design notes (the assignment's questions)" | `docs/assignments/monorepo-migration.md` |
| "Design notes (the Google OAuth / better-auth assignment's questions)" | `docs/assignments/google-oauth-better-auth.md` |

Each new file gets an `# <title>` heading and a one-line intro naming the assignment it answers; the Q&A bodies are copied verbatim.

## Out of scope

- No code, config, or CI changes.
- No rewriting of the Q&A content itself.
- No screenshots or badges.

## Verification

- `pnpm format:check` passes on the touched markdown.
- Every relative link in the README and the two new files resolves to an existing path.
- The two Q&A sections exist in `docs/assignments/` and no longer in `README.md`.
