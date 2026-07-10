// One-off backfill: tasks completed before completedAt existed get
// completedAt = updatedAt (fair proxy for when completion happened).
// Run manually FROM apps/server (--env-file resolves against cwd):
//   pnpm exec tsx --env-file=.env/.env.dev src/scripts/backfill-completed-at.ts
// Idempotent: the filter only matches docs still missing completedAt, so a
// second run reports 0.
import mongoose from 'mongoose';
import { env } from '../shared/config/env.ts';
import { TaskModel } from '../modules/task/task.schema.ts';

await mongoose.connect(env.MONGODB_URI);

// Aggregation-pipeline update: only way to copy one field's value into another
// server-side. { timestamps: false } stops Mongoose bumping updatedAt mid-copy.
const { modifiedCount } = await TaskModel.updateMany(
  { isCompleted: true, completedAt: null }, // null matches missing fields too
  [{ $set: { completedAt: '$updatedAt' } }],
  // Mongoose 9 refuses pipeline updates unless you opt in explicitly.
  { timestamps: false, updatePipeline: true },
);

console.log(`backfilled completedAt on ${modifiedCount} task(s)`);
await mongoose.disconnect();
