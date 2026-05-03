import { PostEntity } from './post.ts';
import { PostModel, PostDoc } from './postSchema.ts';
import { CommentModel } from '../comment/commentSchema.ts';
import { CreatePostBodyDto, UpdatePostBodyDto } from './post.dto.ts';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.ts';
import { logger } from '../../shared/utils/logger.ts';

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
  return findExistingPost(id);
}

export async function createPost(authorId: string, dto: CreatePostBodyDto): Promise<PostEntity> {
  const doc = await PostModel.create({
    userId: authorId,
    title: dto.title,
    content: dto.content,
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
  await findOwnedPost(authorId, id, 'update');

  const doc = (await PostModel.findOneAndUpdate({ _id: id, isDeleted: false }, dto, {
    new: true,
  }).lean())!;
  logger.info(`Post updated: id=${id}`);
  return toPost(doc);
}

export async function deletePost(authorId: string, id: string): Promise<void> {
  await findOwnedPost(authorId, id, 'delete');

  await PostModel.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
  await CommentModel.updateMany(
    { postId: id, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );

  logger.info(`Post deleted: id=${id}`);
}

export async function likePost(id: string): Promise<PostEntity> {
  const doc = await PostModel.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $inc: { likesCount: 1 } },
    { new: true },
  ).lean();

  if (!doc) throw new NotFoundError('Post not found');

  return toPost(doc);
}

async function findExistingPost(id: string): Promise<PostEntity> {
  const doc = await PostModel.findOne({ _id: id, isDeleted: false }).lean();

  if (!doc) throw new NotFoundError('Post not found');

  return toPost(doc);
}

async function findOwnedPost(authorId: string, id: string, action: string): Promise<PostEntity> {
  const post = await findExistingPost(id);

  if (post.userId !== authorId) throw new ForbiddenError(`You can only ${action} your own posts`);

  return post;
}
