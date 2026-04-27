[![CI](https://github.com/nadavramon/server/actions/workflows/ci.yml/badge.svg)](https://github.com/nadavramon/server/actions/workflows/ci.yml)

# server

A TypeScript + Express REST API with JWT auth and MongoDB persistence via Mongoose. Manages users and tasks (todos).

## Tech stack

- **Node.js** ≥ 24 (`tsx` for dev, `tsc` for production builds)
- **Express 5** for HTTP routing
- **Mongoose 9** for the request path (users, tasks, refresh tokens)
- **MongoDB driver** for the seed script only (`src/scripts/seedBlogs.ts`)
- **JWT** access + refresh tokens; refresh tokens persisted with a TTL index for auto-cleanup
- **Zod** for request DTO validation
- **Vitest** for tests

## Getting started

### Prerequisites

- Node.js 24+
- A running MongoDB instance (local or remote)

### Setup

```bash
npm install
cp .env.example .env/.env.dev   # then fill in real values
npm run dev
```

The server boots on `http://localhost:3000`. Hit `GET /health` to confirm it's up. Swagger UI is at `/api-docs`.

### Environment variables

See [.env.example](./.env.example). All four are required.

| Variable               | Purpose                        |
| ---------------------- | ------------------------------ |
| `PORT`                 | HTTP port                      |
| `JWT_SECRET`           | Signing key for access tokens  |
| `REFRESH_TOKEN_SECRET` | Signing key for refresh tokens |
| `MONGODB_URI`          | Mongo connection string        |

## Scripts

| Command              | What it does                          |
| -------------------- | ------------------------------------- |
| `npm run dev`        | Start with hot-reload (tsx watch)     |
| `npm run build`      | Compile to `dist/`                    |
| `npm start`          | Run compiled output                   |
| `npm run typecheck`  | `tsc --noEmit`                        |
| `npm test`           | Vitest run                            |
| `npm run format`     | Prettier write                        |
| `npm run seed:blogs` | One-off seed for the blogs collection |

## Project structure

```
src/
  index.ts                 # boot + graceful shutdown
  modules/
    auth/                  # register, login, refresh, logout
    user/                  # users
    task/                  # tasks (todos)
  shared/
    config/                # env loader, Mongoose connection
    middlewares/           # auth, rate limiter, error handler, http logger
    errors/                # AppError hierarchy
    utils/                 # logger, swagger
    types/                 # Express type augmentation
  scripts/
    seedBlogs.ts           # raw MongoDB driver (not via Mongoose)
```

Each `modules/<name>/` folder follows the same layout: `<name>.ts` (domain types), `<name>Schema.ts` (Mongoose schema), `<name>Model.ts` (async data access + mapper), `<name>Service.ts` (business logic), `<name>Controller.ts` (HTTP handlers), `<name>Routes.ts` (route wiring), `<name>.dto.ts` (Zod request shapes).
