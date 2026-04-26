import { Request, Response, NextFunction } from 'express';
import * as taskService from './taskService.ts';
import { CreateTaskBodySchema, UpdateTaskBodySchema, GetTasksQuerySchema } from './task.dto.ts';
import { ValidationError } from '../../shared/errors/AppError.ts';

export async function getTasks(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = GetTasksQuerySchema.safeParse(req.query);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]!.message);
    }

    const { isCompleted } = result.data;

    if (isCompleted !== undefined) {
      const tasks = await taskService.getTasksByStatus(req.user!.userId, isCompleted);
      res.status(200).json(tasks);
      return;
    }

    const tasks = await taskService.getAllTasks(req.user!.userId);
    res.status(200).json(tasks);
  } catch (err) {
    next(err);
  }
}

export async function getTaskById(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const task = await taskService.getTaskById(req.user!.userId, req.params.id as string);
    res.status(200).json(task);
  } catch (err) {
    next(err);
  }
}

export async function createTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const result = CreateTaskBodySchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]!.message);
    }

    const newTask = await taskService.createTask(req.user!.userId, result.data);
    res.status(201).json(newTask);
  } catch (err) {
    next(err);
  }
}

export async function updateTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { id } = req.params;
    const { userId } = req.user!;
    const result = UpdateTaskBodySchema.safeParse(req.body);
    if (!result.success) {
      throw new ValidationError(result.error.issues[0]!.message);
    }

    const updatedTask = await taskService.updateTask(userId, id as string, result.data);
    res.status(200).json(updatedTask);
  } catch (err) {
    next(err);
  }
}

export async function deleteTask(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    await taskService.deleteTask(req.user!.userId, req.params.id as string);
    res.status(204).json({ message: 'Task deleted successfully' });
  } catch (err) {
    next(err);
  }
}
