import express from 'express';
import { env } from './shared/config/env.ts';
import taskRoutes from './modules/task/taskRoutes.ts';
import authRoutes from './modules/auth/authRoutes.ts';
import { httpLogger } from './shared/middlewares/httpLogger.ts';
import { errorHandler } from './shared/middlewares/errorHandler.ts';
import { logger } from './shared/utils/logger.ts';
import { swaggerUi, swaggerSpec } from './shared/utils/swagger.ts';
import { limiter } from './shared/middlewares/rateLimiter.ts';

const app = express();

app.get('/health', (_req, res) => {
  res.status(200).json({ status: 'ok' });
});

app.use(httpLogger);
app.use(express.json());

app.use(limiter);
app.use('/auth', authRoutes);
app.use('/tasks', taskRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(errorHandler);

app.listen(env.PORT, () => {
  logger.info(`Server running at http://localhost:${env.PORT}`);
});
