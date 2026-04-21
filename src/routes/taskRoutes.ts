import { Router } from 'express';
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

router.route('/').get(getTasks).post(createTask);

router.route('/:id').get(getTaskById).put(updateTask).delete(deleteTask);

export default router;
