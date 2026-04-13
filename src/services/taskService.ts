import { randomUUID } from 'crypto';
import { TaskEntity } from '../types/task.ts';
import * as taskModel from '../models/taskModel.ts';
import { NotFoundError } from '../errors/NotFoundError.ts';
import { CreateTaskBodyDto, UpdateTaskBodyDto } from '../dtos/task.dto.ts';
import { logger } from '../utils/logger.ts';

export function getAllTasks(): TaskEntity[] {
  return taskModel.findAll();
}

export function getTasksByStatus(isCompleted: boolean): TaskEntity[] {
  return taskModel.findByStatus(isCompleted);
}

export function getTaskById(id: string): TaskEntity {
  const task = taskModel.findById(id);

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  return task;
}

export function createTask(dto: CreateTaskBodyDto): TaskEntity {
  const newTask: TaskEntity = {
    id: randomUUID(),
    title: dto.title,
    isCompleted: dto.isCompleted ?? false,
  };

  const created = taskModel.create(newTask);
  logger.info(`Task created: id=${created.id}, title="${created.title}"`);
  return created;
}

export function updateTask(id: string, dto: UpdateTaskBodyDto): TaskEntity {
  const existingTask = taskModel.findById(id);
  if (!existingTask) {
    throw new NotFoundError('Task not found');
  }

  const updated = taskModel.update(id, dto as Partial<Omit<TaskEntity, 'id'>>)!;
  logger.info(`Task updated: id=${updated.id}`);
  return updated;
}

export function deleteTask(id: string): void {
  const removed = taskModel.remove(id);

  if (!removed) {
    throw new NotFoundError('Task not found');
  }

  logger.info(`Task deleted: id=${id}`);
}
