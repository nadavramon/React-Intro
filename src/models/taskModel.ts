import { TaskEntity } from '../types/task.ts';

const taskStore: TaskEntity[] = [];

export function findAll(): TaskEntity[] {
  return taskStore;
}

export function findByStatus(isCompleted: boolean): TaskEntity[] {
  return taskStore.filter((task) => task.isCompleted === isCompleted);
}

export function findById(id: string): TaskEntity | undefined {
  return taskStore.find((task) => task.id === id);
}

export function create(task: TaskEntity): TaskEntity {
  taskStore.push(task);
  return task;
}

export function update(id: string, data: Partial<Omit<TaskEntity, 'id'>>): TaskEntity | undefined {
  const task = taskStore.find((t) => t.id === id);

  if (!task) {
    return undefined;
  }

  if (data.title !== undefined) {
    task.title = data.title;
  }

  if (data.isCompleted !== undefined) {
    task.isCompleted = data.isCompleted;
  }

  return task;
}

export function remove(id: string): boolean {
  const index = taskStore.findIndex((task) => task.id === id);

  if (index === -1) {
    return false;
  }

  taskStore.splice(index, 1);
  return true;
}
