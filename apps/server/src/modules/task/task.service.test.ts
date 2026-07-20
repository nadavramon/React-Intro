import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./task.schema.ts', () => ({
  TaskModel: {
    find: vi.fn(),
    findOne: vi.fn(),
    create: vi.fn(),
    findOneAndUpdate: vi.fn(),
  },
}));

vi.mock('./task.cache.ts', () => ({
  read: vi.fn(),
  write: vi.fn(),
  invalidate: vi.fn(),
}));

import { TaskModel } from './task.schema.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
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
// The mapped/cached shape is the shared Task out-DTO — no userId (docA, a DB
// doc, keeps its userId; toTask strips it via taskSchema.parse).
const entityA = { id: 't1', title: 'A', isCompleted: false };
const entityDone = { id: 't2', title: 'B', isCompleted: true };

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
    expect(TaskModel.find).toHaveBeenCalledWith({ userId, isDeleted: { $ne: true } });
    expect(taskCache.write).toHaveBeenCalledWith(userId, [entityA]);
  });

  it('never returns userId on task objects (out-DTO enforced)', async () => {
    vi.mocked(taskCache.read).mockResolvedValue(null);
    vi.mocked(TaskModel.find).mockReturnValue({
      lean: () => Promise.resolve([docA]),
    } as never);

    const tasks = await getAllTasks(userId);

    expect(tasks[0]).not.toHaveProperty('userId');
    expect(tasks[0]).toEqual({ id: 't1', title: docA.title, isCompleted: docA.isCompleted });
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
    vi.mocked(TaskModel.findOne).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);
    vi.mocked(TaskModel.findOneAndUpdate).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);
    await updateTask(userId, 't1', { title: 'B' } as never);
    expect(taskCache.invalidate).toHaveBeenCalledWith(userId);
  });
});

describe('completedAt tracks the completion transition', () => {
  const currentIncomplete = { ...docA, isCompleted: false };
  const currentComplete = { ...docA, isCompleted: true };

  function mockCurrent(doc: unknown) {
    vi.mocked(TaskModel.findOne).mockReturnValue({
      lean: () => Promise.resolve(doc),
    } as never);
    vi.mocked(TaskModel.findOneAndUpdate).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);
  }

  it('createTask with isCompleted:true stamps completedAt', async () => {
    vi.mocked(TaskModel.create).mockResolvedValue({ toObject: () => docA } as never);
    await createTask(userId, { title: 'A', isCompleted: true } as never);
    expect(TaskModel.create).toHaveBeenCalledWith(
      expect.objectContaining({ isCompleted: true, completedAt: expect.any(Date) }),
    );
  });

  it('createTask default leaves completedAt null', async () => {
    vi.mocked(TaskModel.create).mockResolvedValue({ toObject: () => docA } as never);
    await createTask(userId, { title: 'A' } as never);
    expect(TaskModel.create).toHaveBeenCalledWith(expect.objectContaining({ completedAt: null }));
  });

  it('update false→true stamps completedAt', async () => {
    mockCurrent(currentIncomplete);
    await updateTask(userId, 't1', { isCompleted: true } as never);
    expect(TaskModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 't1', userId, isDeleted: { $ne: true } },
      expect.objectContaining({ completedAt: expect.any(Date) }),
      expect.anything(),
    );
  });

  it('update true→false clears completedAt (clock restarts on re-complete)', async () => {
    mockCurrent(currentComplete);
    await updateTask(userId, 't1', { isCompleted: false } as never);
    expect(TaskModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 't1', userId, isDeleted: { $ne: true } },
      expect.objectContaining({ completedAt: null }),
      expect.anything(),
    );
  });

  it('redundant isCompleted:true does NOT reset the clock', async () => {
    mockCurrent(currentComplete);
    await updateTask(userId, 't1', { isCompleted: true } as never);
    const update = vi.mocked(TaskModel.findOneAndUpdate).mock.calls[0]![1];
    expect(update).not.toHaveProperty('completedAt');
  });

  it('title-only update does NOT touch completedAt', async () => {
    mockCurrent(currentComplete);
    await updateTask(userId, 't1', { title: 'B' } as never);
    const update = vi.mocked(TaskModel.findOneAndUpdate).mock.calls[0]![1];
    expect(update).not.toHaveProperty('completedAt');
  });

  it('update 404s when the task is soft-deleted (findOne filter)', async () => {
    mockCurrent(null);
    await expect(updateTask(userId, 't1', { title: 'B' } as never)).rejects.toThrow(NotFoundError);
    expect(TaskModel.findOneAndUpdate).not.toHaveBeenCalled();
  });
});

describe('deleteTask soft-deletes', () => {
  it('flips isDeleted/deletedAt instead of removing the doc, then invalidates', async () => {
    vi.mocked(TaskModel.findOneAndUpdate).mockReturnValue({
      lean: () => Promise.resolve(docA),
    } as never);

    await deleteTask(userId, 't1');

    expect(TaskModel.findOneAndUpdate).toHaveBeenCalledWith(
      { _id: 't1', userId, isDeleted: { $ne: true } },
      { isDeleted: true, deletedAt: expect.any(Date) },
      { timestamps: false },
    );
    expect(taskCache.invalidate).toHaveBeenCalledWith(userId);
  });

  it('404s when the task is missing or already soft-deleted', async () => {
    vi.mocked(TaskModel.findOneAndUpdate).mockReturnValue({
      lean: () => Promise.resolve(null),
    } as never);

    await expect(deleteTask(userId, 't1')).rejects.toThrow(NotFoundError);
    expect(taskCache.invalidate).not.toHaveBeenCalled();
  });
});
