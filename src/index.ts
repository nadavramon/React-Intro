import express from 'express';
import taskRoutes from './routes/taskRoutes.ts';
import { logger } from './middlewares/httpLogger.ts';

const app = express();
const port = process.env.PORT;

app.use(logger);
app.use(express.json());

app.use('/tasks', taskRoutes);

app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
