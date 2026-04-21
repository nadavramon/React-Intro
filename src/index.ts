import express from 'express';
import { env } from './config/env.ts';
import taskRoutes from './routes/taskRoutes.ts';
import authRoutes from './routes/authRoutes.ts';
import { httpLogger } from './middlewares/httpLogger.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { logger } from './utils/logger.ts';
import { swaggerUi, swaggerSpec } from './utils/swagger.ts';
import { limiter } from './middlewares/rateLimiter.ts';

const app = express();

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
