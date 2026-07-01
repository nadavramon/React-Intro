import { Schema, model, InferSchemaType, Types } from 'mongoose';

const postSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true, trim: true },
    content: { type: String, required: true, trim: true },
    likesCount: { type: Number, default: 0 },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

export type PostDoc = InferSchemaType<typeof postSchema> & {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
};

export const PostModel = model('Post', postSchema);
