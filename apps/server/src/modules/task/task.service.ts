import { Task, taskSchema } from '@repo/shared';
import { TaskModel, TaskDoc } from './task.schema.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
import { CreateTaskBodyDto, UpdateTaskBodyDto } from './task.dto.ts';
import { logger } from '../../shared/utils/logger.ts';
import * as taskCache from './task.cache.ts';

// Project the DB doc through the shared out-schema. parse() strips anything
// not in the contract (so userId can never reach the client) and throws if the
// server ever produces a malformed shape. Symmetric with validate() on the in side.
function toTask(doc: TaskDoc): Task {
  return taskSchema.parse({
    id: doc._id.toString(),
    title: doc.title,
    isCompleted: doc.isCompleted,
  });
}

export async function getAllTasks(userId: string): Promise<Task[]> {
  const cached = await taskCache.read(userId);
  if (cached !== null) return cached;

  const docs = await TaskModel.find({ userId, isDeleted: { $ne: true } }).lean();
  const tasks = docs.map(toTask);
  await taskCache.write(userId, tasks);
  return tasks;
}

export async function getTasksByStatus(userId: string, isCompleted: boolean): Promise<Task[]> {
  const tasks = await getAllTasks(userId);
  return tasks.filter((t) => t.isCompleted === isCompleted);
}

export async function getTaskById(userId: string, id: string): Promise<Task> {
  const doc = await TaskModel.findOne({ _id: id, userId, isDeleted: { $ne: true } }).lean();
  if (!doc) throw new NotFoundError('Task not found');

  return toTask(doc);
}

export async function createTask(userId: string, dto: CreateTaskBodyDto): Promise<Task> {
  const doc = await TaskModel.create({
    userId,
    title: dto.title,
    isCompleted: dto.isCompleted ?? false,
  });
  const task = toTask(doc.toObject());
  logger.info(`Task created: id=${task.id}, title="${task.title}"`);
  await taskCache.invalidate(userId);
  return task;
}

export async function updateTask(
  userId: string,
  id: string,
  dto: UpdateTaskBodyDto,
): Promise<Task> {
  const doc = await TaskModel.findOneAndUpdate({ _id: id, userId }, dto, {
    returnDocument: 'after',
  }).lean();
  if (!doc) throw new NotFoundError('Task not found');

  logger.info(`Task updated: id=${id}`);
  await taskCache.invalidate(userId);
  return toTask(doc);
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  // Soft delete: deletion is a state, not an event — restorable, auditable,
  // and the same isDeleted filter hides it from every read.
  const doc = await TaskModel.findOneAndUpdate(
    { _id: id, userId, isDeleted: { $ne: true } },
    { isDeleted: true, deletedAt: new Date() },
  ).lean();
  if (!doc) throw new NotFoundError('Task not found');

  logger.info(`Task soft-deleted: id=${id}`);
  await taskCache.invalidate(userId);
}
