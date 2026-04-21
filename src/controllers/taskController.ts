import { Request, Response, NextFunction } from 'express';
import * as taskService from '../services/taskService.ts';
import {
  CreateTaskBodySchema,
  UpdateTaskBodySchema,
  GetTasksQuerySchema,
} from '../dtos/task.dto.ts';
import { ValidationError } from '../errors/AppError.ts';

export function getTasks(req: Request, res: Response, next: NextFunction): void {
  try {
    const result = GetTasksQuerySchema.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]!.message);
    }

    const { isCompleted } = result.data;

    if (isCompleted !== undefined) {
      res.status(200).json(taskService.getTasksByStatus(req.user!.userId, isCompleted));
      return;
    }

    res.status(200).json(taskService.getAllTasks(req.user!.userId));
  } catch (err) {
    next(err);
  }
}

export function getTaskById(req: Request, res: Response, next: NextFunction): void {
  try {
    const task = taskService.getTaskById(req.user!.userId, req.params.id as string);
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

export function createTask(req: Request, res: Response, next: NextFunction): void {
  try {
    const result = CreateTaskBodySchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]!.message);
    }

    const newTask = taskService.createTask(req.user!.userId, result.data);
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
}

export function updateTask(req: Request, res: Response, next: NextFunction): void {
  try {
    const { id } = req.params;
    const { userId } = req.user!;
    const result = UpdateTaskBodySchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]!.message);
    }

    const updatedTask = taskService.updateTask(userId, id as string, result.data);
    res.status(200).json(updatedTask);
  } catch (err) {
    next(err);
  }
}

export function deleteTask(req: Request, res: Response, next: NextFunction): void {
  try {
    taskService.deleteTask(req.user!.userId, req.params.id as string);
    res.status(204).json({ message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
}
