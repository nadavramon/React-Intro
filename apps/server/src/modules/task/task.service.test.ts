import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./task.schema.ts', () => ({
  TaskModel: {
    find: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
    findOneAndDelete: vi.fn(),
  },
}));

vi.mock('./task.cache.ts', () => ({
  read: vi.fn(),
  write: vi.fn(),
  invalidate: vi.fn(),
}));

import { TaskModel } from './task.schema.ts';
import * as taskCache from './task.cache.ts';
import {
  getAllTasks,
  getTasksByStatus,
  createTask,
  updateTask,
  deleteTask,
} from './task.service.ts';

const userId = 'user-1';
const docA = {
  _id: { toString: () => 't1' },
  userId: { toString: () => userId },
  title: 'A',
  isCompleted: false,
};
const entityA = { id: 't1', userId, title: 'A', isCompleted: false };
const entityDone = { id: 't2', userId, title: 'B', isCompleted: true };

beforeEach(() => vi.clearAllMocks());

describe('getAllTasks cache-aside', () => {
  it('returns cached tasks without hitting Mongo on hit', async () => {
    vi.mocked(taskCache.read).mockResolvedValue([entityA]);
    const result = await getAllTasks(userId);
    expect(result).toEqual([entityA]);
    expect(TaskModel.find).not.toHaveBeenCalled();
    expect(taskCache.write).not.toHaveBeenCalled();
  });

  it('queries Mongo and writes cache on miss', async () => {
    vi.mocked(taskCache.read).mockResolvedValue(null);
    vi.mocked(TaskModel.find).mockReturnValue({
      lean: () => Promise.resolve([docA]),
    } as never);
    const result = await getAllTasks(userId);
    expect(result).toEqual([entityA]);
    expect(TaskModel.find).toHaveBeenCalledWith({ userId });
    expect(taskCache.write).toHaveBeenCalledWith(userId, [entityA]);
  });
});

describe('getTasksByStatus derives from the cached list', () => {
  it('filters the cached list in memory without a status query', async () => {
    vi.mocked(taskCache.read).mockResolvedValue([entityA, entityDone]);
    const result = await getTasksByStatus(userId, true);
    expect(result).toEqual([entityDone]);
    expect(TaskModel.find).not.toHaveBeenCalled();
  });
});

describe('writes invalidate the user cache', () => {
  it('createTask invalidates after a successful insert', async () => {
    vi.mocked(TaskModel.create).mockResolvedValue({ toObject: () => docA } as never);
    await createTask(userId, { title: 'A' } as never);
    expect(taskCache.invalidate).toHaveBeenCalledWith(userId);
  });

  it('updateTask invalidates after a successful update', async () => {
    vi.mocked(TaskModel.findOneAndUpdate).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);
    await updateTask(userId, 't1', { title: 'B' } as never);
    expect(taskCache.invalidate).toHaveBeenCalledWith(userId);
  });

  it('deleteTask invalidates after a successful delete', async () => {
    vi.mocked(TaskModel.findOneAndDelete).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);
    await deleteTask(userId, 't1');
    expect(taskCache.invalidate).toHaveBeenCalledWith(userId);
  });
});
