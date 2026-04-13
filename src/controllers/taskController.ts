import { Request, Response, NextFunction } from 'express';
import * as taskService from '../services/taskService.ts';

export function getTasks(req: Request, res: Response, next: NextFunction): void {
  try {
    const { isCompleted } = req.query;

    if (isCompleted !== undefined) {
      const tasks = taskService.getTasksByStatus(isCompleted as string);
      res.status(200).json(tasks);
      return;
    }

    const tasks = taskService.getAllTasks();
    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
}

export function getTaskById(req: Request, res: Response, next: NextFunction): void {
  try {
    const task = taskService.getTaskById(req.params.id as string);
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

export function createTask(req: Request, res: Response, next: NextFunction): void {
  try {
    const newTask = taskService.createTask(req.body.title);
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
}

export function updateTask(req: Request, res: Response, next: NextFunction): void {
  try {
    const { title, isCompleted } = req.body;
    const updatedTask = taskService.updateTask(req.params.id as string, { title, isCompleted });
    res.status(200).json(updatedTask);
  } catch (err) {
    next(err);
  }
}

export function deleteTask(req: Request, res: Response, next: NextFunction): void {
  try {
    taskService.deleteTask(req.params.id as string);
    res.status(204).json({ message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
}
