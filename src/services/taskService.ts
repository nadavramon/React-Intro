import { randomUUID } from 'crypto';
import { TaskEntity } from '../types/task.ts';
import * as taskModel from '../models/taskModel.ts';
import { NotFoundError } from '../errors/NotFoundError.ts';
import { ValidationError } from '../errors/ValidationError.ts';

export function getAllTasks(): TaskEntity[] {
  return taskModel.findAll();
}

export function getTasksByStatus(isCompleted: string): TaskEntity[] {
  if (isCompleted !== 'true' && isCompleted !== 'false') {
    throw new ValidationError('isCompleted must be "true" or "false"');
  }

  const completed = isCompleted === 'true';
  return taskModel.findByStatus(completed);
}

export function getTaskById(id: string): TaskEntity {
  const task = taskModel.findById(id);

  if (!task) {
    throw new NotFoundError('Task not found');
  }

  return task;
}

export function createTask(title: unknown): TaskEntity {
  if (!title || typeof title !== 'string' || title.trim() === '') {
    throw new ValidationError('Title is required and must be a non-empty string');
  }

  if (title.length > 255) {
    throw new ValidationError('Title is too long (maximum 255 characters)');
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
    throw new ValidationError('Please provide either a title or isCompleted status to update');
  }

  const existingTask = taskModel.findById(id);
  if (!existingTask) {
    throw new NotFoundError('Task not found');
  }

  const updateData: Partial<Omit<TaskEntity, 'id'>> = {};

  if (data.title !== undefined) {
    if (typeof data.title !== 'string' || data.title.trim() === '') {
      throw new ValidationError('Title must be a non-empty string');
    }

    if (data.title.length > 255) {
      throw new ValidationError('Title is too long (maximum 255 characters)');
    }

    updateData.title = data.title.trim();
  }

  if (data.isCompleted !== undefined) {
    if (typeof data.isCompleted !== 'boolean') {
      throw new ValidationError('Completed must be a boolean');
    }

    updateData.isCompleted = data.isCompleted;
  }

  const updatedTask = taskModel.update(id, updateData);
  return updatedTask!;
}

export function deleteTask(id: string): void {
  const removed = taskModel.remove(id);

  if (!removed) {
    throw new NotFoundError('Task not found');
  }
}
