import { TaskEntity } from './task.ts';
import { TaskModel, TaskDoc } from './taskSchema.ts';

function toTask(doc: TaskDoc): TaskEntity {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    title: doc.title,
    isCompleted: doc.isCompleted,
  };
}

export async function findAll(userId: string): Promise<TaskEntity[]> {
  const docs = await TaskModel.find({ userId }).lean();
  return docs.map(toTask);
}

export async function findByStatus(userId: string, isCompleted: boolean): Promise<TaskEntity[]> {
  const docs = await TaskModel.find({ userId, isCompleted }).lean();
  return docs.map(toTask);
}

export async function findById(id: string): Promise<TaskEntity | null> {
  const doc = await TaskModel.findById(id).lean();
  return doc ? toTask(doc) : null;
}

export async function create(input: Omit<TaskEntity, 'id'>): Promise<TaskEntity> {
  const doc = await TaskModel.create(input);
  return toTask(doc.toObject());
}

export async function update(
  id: string,
  data: Partial<Omit<TaskEntity, 'id' | 'userId'>>,
): Promise<TaskEntity | null> {
  const doc = await TaskModel.findByIdAndUpdate(id, data, { new: true }).lean();
  return doc ? toTask(doc) : null;
}

export async function remove(id: string): Promise<boolean> {
  const doc = await TaskModel.findByIdAndDelete(id).lean();
  return doc !== null;
}
