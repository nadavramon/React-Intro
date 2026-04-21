import { Router } from 'express';
import { getTasks, getTaskById, createTask, updateTask, deleteTask } from './taskController.ts';
import { authenticate } from '../../shared/middlewares/authenticate.ts';

const router = Router();

router.use(authenticate);

router.route('/').get(getTasks).post(createTask);

router.route('/:id').get(getTaskById).put(updateTask).delete(deleteTask);

export default router;
