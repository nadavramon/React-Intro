# Assignment write-up — polyrepo → Turborepo monorepo

Q&A answers for the monorepo-migration assignment (see the matching spec/plan in `../superpowers/`). Moved verbatim from the README on 2026-07-10.

### What lives in `packages/shared`, and why is it better than duplication?

Only the **public API contract**: `taskSchema`/`Task`, `createTaskBodySchema`, `updateTaskBodySchema`, and `userPublicSchema`/`User` (+ `UserRole`). Each export is a **zod schema plus its `z.infer` type**, so one definition provides both compile-time types and runtime validation. Deliberately _not_ in shared: server internals — mongoose schemas, `UserEntity.password`, `TaskEntity.userId`.

Versus duplication: before the merge, the web's `Task` and the server's `TaskEntity` had already silently drifted apart. With one shared definition, a contract change becomes a **compile error** on whichever side lags instead of a runtime surprise; and both sides can validate with the very same schema the other side was typed against.

### What does Turborepo add beyond pnpm workspaces?

Workspaces only **link** packages: `@repo/shared` is symlinked into each app's `node_modules` from one root lockfile. Turborepo adds **task orchestration** on top:

- **Dependency graph** — `build` depends on `^build`, so `@repo/shared` always builds before the apps, declared once in `turbo.json`.
- **Caching** — unchanged packages replay their previous output (`>>> FULL TURBO`) instead of rebuilding/retesting.
- **Parallelism + fan-out** — `turbo run dev` starts both apps; `turbo run lint typecheck test build` runs everything in the right order with one command.

### Monolith or microservices? Did the migration change the architecture?

Neither — it's a **two-tier client/server app**: one SPA + one API service talking over HTTP (the API itself is a single monolithic service). The migration changed **repository topology, not runtime architecture**: monorepo-vs-polyrepo is orthogonal to monolith-vs-microservices. There are still exactly two deployable units with the same boundary between them; they just share one repo, one lockfile, one CI, and one contract package now.

### How does each app point to `packages/shared`?

Via the pnpm **workspace protocol**: both apps declare `"@repo/shared": "workspace:*"`, which pnpm resolves to a symlink into `packages/shared`. It's a **built** package — `main`/`types`/`exports` point at `dist/`, and Turbo's `^build` guarantees `dist` exists before an app compiles. The server (TS `nodenext`) consumes the emitted `.js` + `.d.ts`; the web (Vite/bundler resolution) consumes the same entry point. Imports look identical on both sides: `import type { Task } from '@repo/shared'`.
