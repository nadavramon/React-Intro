import { PostEntity } from './post.entity.ts';
import { PostModel, PostDoc } from './post.schema.ts';
import { CommentModel } from '../comment/comment.schema.ts';
import { CreatePostBodyDto, UpdatePostBodyDto } from './post.dto.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
import { logger } from '../../shared/utils/logger.ts';
import { LikeModel } from '../like/like.schema.ts';

function toPost(doc: PostDoc): PostEntity {
  return {
    id: doc._id.toString(),
    userId: doc.userId.toString(),
    title: doc.title,
    content: doc.content,
    likesCount: doc.likesCount,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function getAllPosts(filter: { userId?: string } = {}): Promise<PostEntity[]> {
  const query: { isDeleted: boolean; userId?: string } = { isDeleted: false };
  if (filter.userId) query.userId = filter.userId;

  const docs = await PostModel.find(query).sort({ createdAt: -1 }).lean();
  return docs.map(toPost);
}

export async function getPostById(id: string): Promise<PostEntity> {
  const doc = await PostModel.findOne({ _id: id, isDeleted: false }).lean();
  if (!doc) throw new NotFoundError('Post not found');

  return toPost(doc);
}

export async function createPost(authorId: string, dto: CreatePostBodyDto): Promise<PostEntity> {
  const doc = await PostModel.create({
    userId: authorId,
    ...dto,
  });
  const post = toPost(doc.toObject());
  logger.info(`Post created: id=${post.id}, title="${post.title}"`);
  return post;
}

export async function updatePost(
  authorId: string,
  id: string,
  dto: UpdatePostBodyDto,
): Promise<PostEntity> {
  const doc = await PostModel.findOneAndUpdate(
    { _id: id, isDeleted: false, userId: authorId },
    dto,
    { returnDocument: 'after' },
  ).lean();
  if (!doc) throw new NotFoundError('Post not found');

  logger.info(`Post updated: id=${id}`);
  return toPost(doc);
}

export async function deletePost(authorId: string, id: string): Promise<void> {
  const doc = await PostModel.findOneAndUpdate(
    { _id: id, isDeleted: false, userId: authorId },
    { isDeleted: true, deletedAt: new Date() },
  ).lean();
  if (!doc) throw new NotFoundError('Post not found');

  await Promise.all([
    CommentModel.updateMany(
      { postId: id, isDeleted: false },
      { isDeleted: true, deletedAt: new Date() },
    ),
    LikeModel.deleteMany({ postId: id }),
  ]);

  logger.info(`Post deleted: id=${id}`);
}

export async function assertPostExists(postId: string): Promise<void> {
  const exists = await PostModel.exists({ _id: postId, isDeleted: false });
  if (!exists) throw new NotFoundError('Post not found');
}
