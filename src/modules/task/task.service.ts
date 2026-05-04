import { TaskEntity } from './task.entity.ts';
import { TaskModel, TaskDoc } from './task.schema.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
import { CreateTaskBodyDto, UpdateTaskBodyDto } from './task.dto.ts';
import { logger } from '../../shared/utils/logger.ts';

function toTask(doc: TaskDoc): TaskEntity {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    title: doc.title,
    isCompleted: doc.isCompleted,
  };
}

export async function getAllTasks(userId: string): Promise<TaskEntity[]> {
  const docs = await TaskModel.find({ userId }).lean();
  return docs.map(toTask);
}

export async function getTasksByStatus(
  userId: string,
  isCompleted: boolean,
): Promise<TaskEntity[]> {
  const docs = await TaskModel.find({ userId, isCompleted }).lean();
  return docs.map(toTask);
}

export async function getTaskById(userId: string, id: string): Promise<TaskEntity> {
  const doc = await TaskModel.findOne({ _id: id, userId }).lean();
  if (!doc) throw new NotFoundError('Task not found');

  return toTask(doc);
}

export async function createTask(userId: string, dto: CreateTaskBodyDto): Promise<TaskEntity> {
  const doc = await TaskModel.create({
    userId,
    title: dto.title,
    isCompleted: dto.isCompleted ?? false,
  });
  const task = toTask(doc.toObject());
  logger.info(`Task created: id=${task.id}, title="${task.title}"`);
  return task;
}

export async function updateTask(
  userId: string,
  id: string,
  dto: UpdateTaskBodyDto,
): Promise<TaskEntity> {
  const doc = await TaskModel.findOneAndUpdate({ _id: id, userId }, dto, {
    returnDocument: 'after',
  }).lean();
  if (!doc) throw new NotFoundError('Task not found');

  logger.info(`Task updated: id=${id}`);
  return toTask(doc);
}

export async function deleteTask(userId: string, id: string): Promise<void> {
  const doc = await TaskModel.findOneAndDelete({ _id: id, userId }).lean();
  if (!doc) throw new NotFoundError('Task not found');

  logger.info(`Task deleted: id=${id}`);
}
