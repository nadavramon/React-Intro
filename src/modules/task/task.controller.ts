import { Request, Response } from 'express';
import * as taskService from './task.service.ts';
import { CreateTaskBodySchema, UpdateTaskBodySchema, GetTasksQuerySchema } from './task.dto.ts';
import { validate } from '../../shared/utils/validate.ts';

export async function getTasks(req: Request, res: Response): Promise<void> {
  const query = validate(GetTasksQuerySchema, req.query);
  const { isCompleted } = query;

  if (isCompleted !== undefined) {
    const tasks = await taskService.getTasksByStatus(req.user!.userId, isCompleted);
    res.status(200).json(tasks);
    return;
  }

  const tasks = await taskService.getAllTasks(req.user!.userId);
  res.status(200).json(tasks);
}

export async function getTaskById(req: Request, res: Response): Promise<void> {
  const task = await taskService.getTaskById(req.user!.userId, req.params.id as string);
  res.status(200).json(task);
}

export async function createTask(req: Request, res: Response): Promise<void> {
  const body = validate(CreateTaskBodySchema, req.body);
  const newTask = await taskService.createTask(req.user!.userId, body);
  res.status(201).json(newTask);
}

export async function updateTask(req: Request, res: Response): Promise<void> {
  const { id } = req.params;
  const { userId } = req.user!;
  const body = validate(UpdateTaskBodySchema, req.body);
  const updatedTask = await taskService.updateTask(userId, id as string, body);
  res.status(200).json(updatedTask);
}

export async function deleteTask(req: Request, res: Response): Promise<void> {
  await taskService.deleteTask(req.user!.userId, req.params.id as string);
  res.status(204).send();
}
