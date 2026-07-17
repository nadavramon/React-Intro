import mongoose from 'mongoose';
import { env } from '../shared/config/env.ts';
import { TaskModel } from '../modules/task/task.schema.ts';

await mongoose.connect(env.MONGODB_URI);

try {
  const { modifiedCount } = await TaskModel.updateMany(
    { isCompleted: true, completedAt: null },
    [{ $set: { completedAt: '$updatedAt' } }],
    { timestamps: false, updatePipeline: true },
  );
  console.log(`backfilled completedAt on ${modifiedCount} task(s)`);
} finally {
  await mongoose.disconnect();
}
