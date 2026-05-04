import { PostEntity } from '../post/post.entity.ts';
import { PostModel } from '../post/post.schema.ts';
import { assertPostExists, getPostById } from '../post/post.service.ts';
import { LikeModel } from './like.schema.ts';

export async function likePost(userId: string, postId: string): Promise<PostEntity> {
  await assertPostExists(postId);

  const result = await LikeModel.updateOne(
    { postId, userId },
    { $setOnInsert: { postId, userId } },
    { upsert: true },
  );

  if (result.upsertedCount === 1) {
    await PostModel.updateOne({ _id: postId }, { $inc: { likesCount: 1 } });
  }
  return getPostById(postId);
}

export async function unlikePost(userId: string, postId: string): Promise<PostEntity> {
  await assertPostExists(postId);

  const result = await LikeModel.deleteOne({ postId, userId });

  if (result.deletedCount === 1) {
    await PostModel.updateOne(
      { _id: postId, likesCount: { $gt: 0 } },
      { $inc: { likesCount: -1 } },
    );
  }
  return getPostById(postId);
}
