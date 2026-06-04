---
description: Scaffold a new feature folder under src/features following project conventions
argument-hint: <feature-name>
---

Scaffold a new feature named `$ARGUMENTS` under `src/features/`, following this project's conventions (see CLAUDE.md). First read CLAUDE.md and an existing feature (e.g. `src/features/counter/`) to match the established patterns.

Derive a PascalCase component name from `$ARGUMENTS` (e.g. `user-profile` → `UserProfile`). Then create:

1. **`src/features/$ARGUMENTS/<PascalName>.tsx`** — a minimal, working React component (named export-friendly default export, typed props if any). Use the `@/` alias for any cross-feature imports, never deep relative paths.
2. **`src/features/$ARGUMENTS/index.ts`** — a barrel that re-exports the feature's public surface (the component, and any types).
3. **`src/features/$ARGUMENTS/<PascalName>.test.tsx`** — a Vitest + React Testing Library smoke test that renders the component and asserts something visible (import `describe/it/expect` from `vitest`).

After creating the files, run `npm run test:run` to confirm the new test passes, then summarize what was created. Keep the component minimal — a starting point, not a finished feature.
