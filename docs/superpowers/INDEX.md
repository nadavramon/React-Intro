# Spec-Driven Development — Index

Manifest of every feature run through the SDD pipeline (`/specify → /plan → /implement → /retro`).
See `CLAUDE.md → "Spec-driven workflow"` for how the pipeline works.

**Status legend:** Spec'd → Planned → In progress → Done.

| Feature | Date | Spec | Plan | Status |
| --- | --- | --- | --- | --- |
| Auth refinement (comment-free consolidation) | 2026-07-23 | [spec](specs/2026-07-23-auth-refinement-design.md) | — | Spec'd |
| Task-cleanup refinements (round 2) | 2026-07-10 | [spec](specs/2026-07-10-task-cleanup-refinements-design.md) | [plan](plans/2026-07-10-task-cleanup-refinements-plan.md) | Done |
| README project overview | 2026-07-10 | [spec](specs/2026-07-10-readme-project-overview-design.md) | [plan](plans/2026-07-10-readme-project-overview-plan.md) | Done |
| Task cleanup cron (soft delete) | 2026-07-10 | [spec](specs/2026-07-10-task-cleanup-cron-design.md) | [plan](plans/2026-07-10-task-cleanup-cron-plan.md) | Done |
| Welcome mail via queue (RabbitMQ) | 2026-07-06 | [spec](specs/2026-07-06-welcome-mail-rabbitmq-queue-design.md) | [plan](plans/2026-07-06-welcome-mail-rabbitmq-queue-plan.md) | Done |
| Shared contract hardening (DTO-out) | 2026-07-05 | [spec](specs/2026-07-05-shared-contract-hardening-design.md) | [plan](plans/2026-07-05-shared-contract-hardening-plan.md) | Done |
| Google OAuth via better-auth | 2026-07-03 | [spec](specs/2026-07-03-google-oauth-better-auth-design.md) | [plan](plans/2026-07-03-google-oauth-better-auth-plan.md) | Done |
| Polyrepo → Turborepo monorepo | 2026-06-30 | [spec](specs/2026-06-30-polyrepo-to-monorepo-design.md) | [plan](plans/2026-06-30-polyrepo-to-monorepo-plan.md) | Done |
| Todo cache (Redis cache-aside) | 2026-06-24 | [spec](specs/2026-06-24-todo-cache-design.md) | [plan](plans/2026-06-24-todo-cache-plan.md) | Done |
| Todo search debounce | 2026-06-24 | [spec](specs/2026-06-24-todo-search-debounce-design.md) | [plan](plans/2026-06-24-todo-search-debounce-plan.md) | Done |
| Resolver ambiguity guard | 2026-06-24 | [spec](specs/2026-06-24-resolver-ambiguity-guard-design.md) | [plan](plans/2026-06-24-resolver-ambiguity-guard-plan.md) | Done |
| Retro command | 2026-06-24 | [spec](specs/2026-06-24-retro-command-design.md) | [plan](plans/2026-06-24-retro-command-plan.md) | Done |
| Subagent task equipment | 2026-06-24 | [spec](specs/2026-06-24-subagent-task-equipment-design.md) | [plan](plans/2026-06-24-subagent-task-equipment-plan.md) | Done |
| TanStack Router migration | 2026-06-24 | [spec](specs/2026-06-24-tanstack-router-design.md) | [plan](plans/2026-06-24-tanstack-router-plan.md) | Done |
| SDD command pipeline | 2026-06-24 | [spec](specs/2026-06-24-sdd-command-pipeline-design.md) | — | In progress |
| Todo global state | 2026-06-04 | [spec](specs/2026-06-04-todo-global-state-design.md) | [plan](plans/2026-06-04-todo-global-state-plan.md) | Done |
| Zustand module singleton swap | 2026-06-09 | — | [plan](plans/2026-06-09-zustand-module-singleton-swap-plan.md) | Done |
| Task toast notifications | 2026-05-30 | — | [plan](plans/2026-05-30-task-toast-notifications-plan.md) | Done |
| Tailwind polish | — | — | [plan](plans/tailwind-polish-plan.md) | Done |

> Rows above the Todo entry are pipeline-managed; rows below were backfilled from pre-existing artifacts (some predate the spec step, hence the `—` spec links).
