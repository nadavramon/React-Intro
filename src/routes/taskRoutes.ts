import { Router, RequestHandler } from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
} from '../controllers/taskController.ts';
import { authenticate } from '../middlewares/authenticate.ts';

const router = Router();

router.use(authenticate);

router.route('/')
  .get(getTasks as RequestHandler)
  .post(createTask as RequestHandler);

router.route('/:id')
  .get(getTaskById as RequestHandler)
  .put(updateTask as RequestHandler)
  .delete(deleteTask as RequestHandler);

export default router;
