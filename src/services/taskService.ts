import { randomUUID } from 'crypto';
import { TaskEntity } from '../types/task.ts';
import * as taskModel from '../models/taskModel.ts';
import { NotFoundError } from '../errors/NotFoundError.ts';
import { CreateTaskBodyDto, UpdateTaskBodyDto } from '../dtos/task.dto.ts';

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

  return taskModel.create(newTask);
}

export function updateTask(id: string, dto: UpdateTaskBodyDto): TaskEntity {
  const existingTask = taskModel.findById(id);
  if (!existingTask) {
    throw new NotFoundError('Task not found');
  }

  return taskModel.update(id, dto as Partial<Omit<TaskEntity, 'id'>>)!;
}

export function deleteTask(id: string): void {
  const removed = taskModel.remove(id);

  if (!removed) {
    throw new NotFoundError('Task not found');
  }
}
