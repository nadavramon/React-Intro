import express from 'express';
import taskRoutes from './routes/taskRoutes.ts';
import { httpLogger } from './middlewares/httpLogger.ts';
import { errorHandler } from './middlewares/errorHandler.ts';
import { logger } from './utils/logger.ts';
import { swaggerUi, swaggerSpec } from './utils/swagger.ts';

const app = express();
const port = process.env.PORT;

app.use(httpLogger);
app.use(express.json());

app.use('/tasks', taskRoutes);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.use(errorHandler);

app.listen(port, () => {
    logger.info(`Server running at http://localhost:${port}`);
});
