import { randomUUID } from 'crypto';
import { TaskEntity } from '../types/task.ts';
import * as taskModel from '../models/taskModel.ts';

function throwError(message: string, statusCode: number): never {
  const error: any = new Error(message);
  error.statusCode = statusCode;
  throw error;
}

export function getAllTasks(): TaskEntity[] {
  return taskModel.findAll();
}

export function getTasksByStatus(isCompleted: string): TaskEntity[] {
  if (isCompleted !== 'true' && isCompleted !== 'false') {
    throwError('isCompleted must be "true" or "false"', 400);
  }

  const completed = isCompleted === 'true';
  return taskModel.findByStatus(completed);
}

export function getTaskById(id: string): TaskEntity {
  const task = taskModel.findById(id);

  if (!task) {
    throwError('Task not found', 404);
  }

  return task;
}

export function createTask(title: unknown): TaskEntity {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    throwError('Title is required and must be a non-empty string', 400);
  }

  if (title.length > 255) {
    throwError('Title is too long (maximum 255 characters)', 400);
  }

  const newTask: TaskEntity = {
    id: randomUUID(),
    title: title.trim(),
    isCompleted: false,
  };

  return taskModel.create(newTask);
}

export function updateTask(id: string, data: { title?: unknown; isCompleted?: unknown }): TaskEntity {
  if (data.title === undefined && data.isCompleted === undefined) {
    throwError('Please provide either a title or isCompleted status to update', 400);
  }

  const existingTask = taskModel.findById(id);
  if (!existingTask) {
    throwError('Task not found', 404);
  }

  const updateData: Partial<Omit<TaskEntity, 'id'>> = {};

  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim() === '') {
      throwError('Title must be a non-empty string', 400);
    }

    if (data.title.length > 255) {
      throwError('Title is too long (maximum 255 characters)', 400);
    }

    updateData.title = data.title.trim();
  }

  if (data.isCompleted !== undefined) {
    if (typeof data.isCompleted !== 'boolean') {
      throwError('Completed must be a boolean', 400);
    }

    updateData.isCompleted = data.isCompleted;
  }

  const updatedTask = taskModel.update(id, updateData);
  return updatedTask!;
}

export function deleteTask(id: string): void {
  const removed = taskModel.remove(id);

  if (!removed) {
    throwError('Task not found', 404);
  }
}
