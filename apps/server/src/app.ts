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
import { auth } from './modules/auth/auth.ts';
import { env } from './shared/config/env.ts';

export const app = express();

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(httpLogger);
app.use(cors({ origin: env.WEB_ORIGIN, credentials: true }));
app.use(limiter);
app.all('/api/auth/*splat', toNodeHandler(auth));
app.use(express.json());

app.use('/api/tasks', taskRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

const webDist = path.resolve(import.meta.dirname, '../../web/dist');
if (existsSync(webDist)) {
  app.use(express.static(webDist));
  app.get(/^(?!\/api\/).*/, (_req, res) => {
    res.sendFile(path.join(webDist, 'index.html'));
  });
}

app.use(errorHandler);
