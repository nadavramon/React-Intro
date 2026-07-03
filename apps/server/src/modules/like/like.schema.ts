import { Schema, model, InferSchemaType, Types } from 'mongoose';

const likeSchema = new Schema(
  {
    postId: { type: Schema.Types.ObjectId, ref: 'Post', required: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

export type LikeDoc = InferSchemaType<typeof likeSchema> & {
  _id: Types.ObjectId;
  postId: Types.ObjectId;
  userId: Types.ObjectId;
};

likeSchema.index({ postId: 1, userId: 1 }, { unique: true });

export const LikeModel = model('Like', likeSchema);
