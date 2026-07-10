import { Schema, model, InferSchemaType, Types } from 'mongoose';

const taskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    isCompleted: { type: Boolean, default: false },
    // Server-internal lifecycle fields — deliberately NOT in @repo/shared:
    // none of them cross the HTTP boundary (toTask strips them via parse).
    completedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Covers the nightly cleanup query (isDeleted + isCompleted + completedAt range).
taskSchema.index({ isDeleted: 1, isCompleted: 1, completedAt: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema> & {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
};

export const TaskModel = model('Task', taskSchema);
