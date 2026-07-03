import { Schema, model, InferSchemaType, Types } from 'mongoose';

const commentSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    content: { type: String, required: true, trim: true },
    isDeleted: { type: Boolean, default: false },
    deletedAt: { type: Date },
  },
  { timestamps: true },
);

export type CommentDoc = InferSchemaType<typeof commentSchema> & {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
};

commentSchema.index({ postId: 1, createdAt: -1 });

export const CommentModel = model('Comment', commentSchema);
