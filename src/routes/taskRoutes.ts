import { Router } from 'express';
import {
  getTasks,
  getTaskById,
  createTask,
  updateTask,
  deleteTask,
  getTasksByStatus,
} from '../controllers/taskController.ts';

// Routing map - connecting a URL path to the specific function that processes the request
const router = Router();

// Route handlers
// :id & :status are dynamic parameters -
// they will be extracted from the URL and passed to the controller as req.params.id & req.params.status
router.get('/', getTasks);
router.get('/:id', getTaskById);
router.post('/', createTask);
router.put('/:id', updateTask);
router.delete('/:id', deleteTask);
router.get('/status/:status', getTasksByStatus);

export default router;
