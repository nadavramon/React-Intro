import { TaskEntity } from './task.ts';
import * as taskModel from './taskModel.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
import { CreateTaskBodyDto, UpdateTaskBodyDto } from './task.dto.ts';
import { logger } from '../../shared/utils/logger.ts';

export async function getAllTasks(userId: string): Promise<TaskEntity[]> {
  return taskModel.findAll(userId);
}

export async function getTasksByStatus(
  userId: string,
  isCompleted: boolean,
): Promise<TaskEntity[]> {
  return taskModel.findByStatus(userId, isCompleted);
}

export async function getTaskById(userId: string, id: string): Promise<TaskEntity> {
  const task = await taskModel.findById(id);

  if (!task || task.userId !== userId) {
    throw new NotFoundError('Task not found');
  }

  return task;
}

export async function createTask(userId: string, dto: CreateTaskBodyDto): Promise<TaskEntity> {
  const created = await taskModel.create({
    userId,
    title: dto.title,
    isCompleted: dto.isCompleted ?? false,
  });
  logger.info(`Task created: id=${created.id}, title="${created.title}"`);
  return created;
}

export async function updateTask(
  userId: string,
  id: string,
  dto: UpdateTaskBodyDto,
): Promise<TaskEntity> {
  const task = await taskModel.findById(id);

  if (!task || task.userId !== userId) {
    throw new NotFoundError('Task not found');
  }

  const updated = (await taskModel.update(id, dto as Partial<Omit<TaskEntity, 'id' | 'userId'>>))!;
  logger.info(`Task updated: id=${updated.id}`);
  return updated;
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const task = await taskModel.findById(id);

  if (!task || task.userId !== userId) {
    throw new NotFoundError('Task not found');
  }

  await taskModel.remove(id);
  logger.info(`Task deleted: id=${id}`);
}
