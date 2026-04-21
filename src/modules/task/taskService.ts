import { randomUUID } from 'crypto';
import { TaskEntity } from './task.ts';
import * as taskModel from './taskModel.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
import { CreateTaskBodyDto, UpdateTaskBodyDto } from './task.dto.ts';
import { logger } from '../../shared/utils/logger.ts';

export function getAllTasks(userId: string): TaskEntity[] {
  return taskModel.findAll(userId);
}

export function getTasksByStatus(userId: string, isCompleted: boolean): TaskEntity[] {
  return taskModel.findByStatus(userId, isCompleted);
}

export function getTaskById(userId: string, id: string): TaskEntity {
  const task = taskModel.findById(id);

  if (!task || task.userId !== userId) {
    throw new NotFoundError('Task not found');
  }

  return task;
}

export function createTask(userId: string, dto: CreateTaskBodyDto): TaskEntity {
  const newTask: TaskEntity = {
    id: randomUUID(),
    userId,
    title: dto.title,
    isCompleted: dto.isCompleted ?? false,
  };

  const created = taskModel.create(newTask);
  logger.info(`Task created: id=${created.id}, title="${created.title}"`);
  return created;
}

export function updateTask(userId: string, id: string, dto: UpdateTaskBodyDto): TaskEntity {
  const task = taskModel.findById(id);

  if (!task || task.userId !== userId) {
    throw new NotFoundError('Task not found');
  }

  const updated = taskModel.update(id, dto as Partial<Omit<TaskEntity, 'id' | 'userId'>>)!;
  logger.info(`Task updated: id=${updated.id}`);
  return updated;
}

export function deleteTask(userId: string, id: string): void {
  const task = taskModel.findById(id);

  if (!task || task.userId !== userId) {
    throw new NotFoundError('Task not found');
  }

  taskModel.remove(id);
  logger.info(`Task deleted: id=${id}`);
}
