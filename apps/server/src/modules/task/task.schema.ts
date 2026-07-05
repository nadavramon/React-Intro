import { Schema, model, InferSchemaType, Types } from 'mongoose';

const taskSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true, trim: true },
    isCompleted: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type TaskDoc = InferSchemaType<typeof taskSchema> & {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
};

export const TaskModel = model('Task', taskSchema);
