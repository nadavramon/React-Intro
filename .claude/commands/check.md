---
description: Run the pre-commit gauntlet — lint, typecheck, unit tests (add --e2e for browser tests)
argument-hint: "[--e2e]"
allowed-tools: Bash(pnpm lint), Bash(pnpm typecheck), Bash(pnpm test), Bash(pnpm format:check), Bash(pnpm --filter @repo/web test:e2e), Bash(pnpm turbo run:*)
---

Run this monorepo's quality gauntlet from the **repo root** and report a concise pass/fail summary. Do not fix anything automatically — if something fails, show the relevant errors and stop so I can decide.

1. **Format** — `pnpm format:check`
2. **Lint + typecheck + tests** — `pnpm turbo run lint typecheck test` _(Turbo fans out to @repo/web, @repo/server, @repo/shared and builds shared first; cached packages are skipped)_

**Arguments:** `$ARGUMENTS`

If the arguments contain `--e2e`, also run the slower browser tests as a final step:

3. **E2E tests** — `pnpm --filter @repo/web test:e2e` _(only when `--e2e` is passed; it boots a real browser + dev server, and the Todo flows need the API server + Mongo running)_

If everything passes, say so in one line. If any step fails, show only the failing output (not the noise) and which step failed.
