import { Request, Response } from 'express';
import * as taskService from '../services/taskService.ts';

export function getTasks(req: Request, res: Response): void {
  const { isCompleted } = req.query;

  if (isCompleted !== undefined) {
    const tasks = taskService.getTasksByStatus(isCompleted as string);
    res.status(200).json(tasks);
    return;
  }

  const tasks = taskService.getAllTasks();
  res.status(200).json(tasks);
}

export function getTaskById(req: Request, res: Response): void {
  const task = taskService.getTaskById(req.params.id as string);
  res.status(200).json(task);
}

export function createTask(req: Request, res: Response): void {
  const newTask = taskService.createTask(req.body.title);
  res.status(201).json(newTask);
}

export function updateTask(req: Request, res: Response): void {
  const { title, isCompleted } = req.body;
  const updatedTask = taskService.updateTask(req.params.id as string, { title, isCompleted });
  res.status(200).json(updatedTask);
}

export function deleteTask(req: Request, res: Response): void {
  taskService.deleteTask(req.params.id as string);
  res.status(204).json({ message: 'Task deleted successfully' });
}
