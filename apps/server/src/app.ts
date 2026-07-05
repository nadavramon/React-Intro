import express from 'express';
import { existsSync } from 'node:fs';
import path from 'node:path';
import taskRoutes from './modules/task/task.routes.ts';
import postRoutes from './modules/post/post.routes.ts';
import { httpLogger } from './shared/middlewares/httpLogger.ts';
import { errorHandler } from './shared/middlewares/errorHandler.ts';
import { swaggerUi, swaggerSpec } from './shared/utils/swagger.ts';
import { limiter } from './shared/middlewares/rateLimiter.ts';
import cors from 'cors';
import { toNodeHandler } from 'better-auth/node';
import { auth } from './shared/config/auth.ts';

export const app = express();

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(httpLogger);
app.use(cors({ origin: 'http://localhost:5173', credentials: true }));
// Before the better-auth mount so auth endpoints are rate-limited too
// (express-rate-limit doesn't need a parsed body).
app.use(limiter);
// Must be mounted before express.json(): better-auth reads the raw body itself.
app.all('/api/auth/*splat', toNodeHandler(auth)); // Express 5 wildcard syntax
app.use(express.json());

app.use('/api/tasks', taskRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Serve the web SPA build when present (prod). apps/server/dist/app.js → apps/web/dist
const webDist = path.resolve(import.meta.dirname, '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  // Express 5 uses path-to-regexp v8, which REJECTS a bare '*' path (throws
  // "Missing parameter name" at startup) — use a RegExp instead. Serve the SPA
  // shell for any GET that isn't an /api route, so client-side deep links
  // (/tasks, /counter, …) resolve to index.html. Unknown /api/* still 404s.
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use(errorHandler);
