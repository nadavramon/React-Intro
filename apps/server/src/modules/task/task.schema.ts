import { Schema, model, InferSchemaType, Types } from 'mongoose';

const taskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    isCompleted: { type: Boolean, default: false },
    completedAt: { type: Date, default: null },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

taskSchema.index({ isDeleted: 1, isCompleted: 1, completedAt: 1 });
taskSchema.index({ userId: 1, isDeleted: 1 });

export type TaskDoc = InferSchemaType<typeof taskSchema> & {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
};

export const TaskModel = model('Task', taskSchema);
