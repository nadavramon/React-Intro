---
description: Run the pre-commit gauntlet — lint, typecheck, unit tests (add --e2e for browser tests)
argument-hint: "[--e2e]"
allowed-tools: Bash(npm run lint), Bash(npm run test:run), Bash(npm run test:e2e), Bash(npx tsc:*), Bash(tsc -b)
---

Run this project's quality gauntlet in order and report a concise pass/fail summary. Do not fix anything automatically — if something fails, show the relevant errors and stop so I can decide.

1. **Lint** — `npm run lint`
2. **Typecheck** — `tsc -b`
3. **Unit/component tests** — `npm run test:run`

**Arguments:** `$ARGUMENTS`

If the arguments contain `--e2e`, also run the slower browser tests as a final step:

4. **E2E tests** — `npm run test:e2e`  *(only when `--e2e` is passed; it boots a real browser + dev server, so skip it by default)*

If everything passes, say so in one line. If any step fails, show only the failing output (not the noise) and which step failed.
