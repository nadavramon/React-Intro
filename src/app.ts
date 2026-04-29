import express from 'express';
import taskRoutes from './modules/task/taskRoutes.ts';
import authRoutes from './modules/auth/authRoutes.ts';
import postRoutes from './modules/post/postRoutes.ts';
import { httpLogger } from './shared/middlewares/httpLogger.ts';
import { errorHandler } from './shared/middlewares/errorHandler.ts';
import { swaggerUi, swaggerSpec } from './shared/utils/swagger.ts';
import { limiter } from './shared/middlewares/rateLimiter.ts';

export const app = express();

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(httpLogger);
app.use(express.json());

app.use(limiter);
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/posts', postRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(errorHandler);
