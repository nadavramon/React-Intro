import { Request, Response, RequestHandler } from 'express';
import { randomUUID } from 'crypto';
import { taskStore } from '../data/taskStore.ts';
import { TaskEntity } from '../types/task.ts';

export function getTasks(req: Request, res: Response): void {
  res.status(200).json(taskStore);
}

export function getTaskById(req: Request, res: Response): void {
  const { id } = req.params;
  const task = taskStore.find((task) => task.id === id);

  if (!task) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  res.status(200).json(task);
}

export function createTask(req: Request, res: Response): void {
  const { title } = req.body;

  if (!title || typeof title !== 'string' || title.trim() === '') {
    res.status(400).json({ error: 'Title is required and must be a non-empty string' });
    return;
  }

  if (title.length > 255) {
    res.status(400).json({ error: 'Title is too long (maximum 255 characters)' });
    return;
  }

  const newTask: TaskEntity = {
    id: randomUUID(),
    title: title.trim(),
    isCompleted: false,
  };

  taskStore.push(newTask);
  res.status(201).json(newTask);
}

export function updateTask(req: Request, res: Response): void {
  const { id } = req.params;
  const { title, isCompleted } = req.body as Partial<TaskEntity>;

  if (title === undefined && isCompleted === undefined) {
    res.status(400).json({ error: 'Please provide either a title or isCompleted status to update' });
    return;
  }

  const taskIndex = taskStore.findIndex((task) => task.id === id);

  const taskToUpdate = taskStore[taskIndex];
  if (!taskToUpdate) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  if (title !== undefined) {
    if (typeof title !== 'string' || title.trim() === '') {
      res.status(400).json({ error: 'Title must be a non-empty string' });
      return;
    }

    if (title.length > 255) {
      res.status(400).json({ error: 'Title is too long (maximum 255 characters)' });
      return;
    }

    taskToUpdate.title = title.trim();
  }

  if (isCompleted !== undefined) {
    if (typeof isCompleted !== 'boolean') {
      res.status(400).json({ error: 'Completed must be a boolean' });
      return;
    }
    taskToUpdate.isCompleted = isCompleted;
  }

  res.status(200).json(taskToUpdate);
}

export function deleteTask(req: Request, res: Response): void {
  const { id } = req.params;
  const taskIndex = taskStore.findIndex((task) => task.id === id);

  if (taskIndex === -1) {
    res.status(404).json({ error: 'Task not found' });
    return;
  }

  taskStore.splice(taskIndex, 1);
  res.status(204).json({ message: 'Task deleted successfully' });
}

export function getTasksByStatus(req: Request, res: Response): void {
  const { status } = req.query;

  if (status !== 'true' && status !== 'false') {
    res.status(400).json({ error: 'Status must be strictly "true" or "false"' });
    return;
  }

  const completed = status === 'true';
  const filteredTasks = taskStore.filter((task) => task.isCompleted === completed);

  res.status(200).json(filteredTasks);
}
