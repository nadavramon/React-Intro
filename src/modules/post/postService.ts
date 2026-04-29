import { PostEntity } from './post.ts';
import * as postModel from './postModel.ts';
import type { UpdatePostInput } from './postModel.ts';
import { CreatePostBodyDto, UpdatePostBodyDto } from './post.dto.ts';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.ts';
import { logger } from '../../shared/utils/logger.ts';

export async function getAllPosts(filter: { userId?: string } = {}): Promise<PostEntity[]> {
  return postModel.findAll(filter);
}

export async function getPostById(id: string): Promise<PostEntity> {
  return findExistingPost(id);
}

export async function createPost(authorId: string, dto: CreatePostBodyDto): Promise<PostEntity> {
  const created = await postModel.create({
    userId: authorId,
    title: dto.title,
    content: dto.content,
  });

  logger.info(`Post created: id=${created.id}, title="${created.title}"`);
  return created;
}

export async function updatePost(
  authorId: string,
  id: string,
  dto: UpdatePostBodyDto,
): Promise<PostEntity> {
  await findOwnedPost(authorId, id, 'update');

  const updated = (await postModel.update(id, dto as UpdatePostInput))!;
  logger.info(`Post updated: id=${updated.id}`);
  return updated;
}

export async function deletePost(authorId: string, id: string): Promise<void> {
  await findOwnedPost(authorId, id, 'delete');
  await postModel.softRemove(id);

  logger.info(`Post deleted: id=${id}`);
}

async function findExistingPost(id: string): Promise<PostEntity> {
  const post = await postModel.findById(id);

  if (!post) throw new NotFoundError('Post not found');

  return post;
}

async function findOwnedPost(authorId: string, id: string, action: string): Promise<PostEntity> {
  const post = await findExistingPost(id);

  if (post.userId !== authorId) throw new ForbiddenError(`You can only ${action} your own posts`);

  return post;
}
