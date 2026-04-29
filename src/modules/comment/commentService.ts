import { CommentEntity } from './comment.ts';
import * as commentModel from './commentModel.ts';
import type { UpdateCommentInput } from './commentModel.ts';
import * as postModel from '../post/postModel.ts';
import { CreateCommentBodyDto, UpdateCommentBodyDto } from './comment.dto.ts';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.ts';
import { logger } from '../../shared/utils/logger.ts';

export async function getCommentsByPost(postId: string): Promise<CommentEntity[]> {
  await assertPostExists(postId);
  return commentModel.findByPostId(postId);
}

export async function createComment(
  authorId: string,
  postId: string,
  dto: CreateCommentBodyDto,
): Promise<CommentEntity> {
  await assertPostExists(postId);

  const created = await commentModel.create({
    postId,
    userId: authorId,
    content: dto.content,
  });
  logger.info(`Comment created: id=${created.id}, postId=${created.postId}`);
  return created;
}

export async function updateComment(
  authorId: string,
  postId: string,
  id: string,
  dto: UpdateCommentBodyDto,
): Promise<CommentEntity> {
  await findOwnedComment(authorId, postId, id, 'edit');

  const updated = (await commentModel.update(id, dto as UpdateCommentInput))!;
  logger.info(`Comment updated: id=${updated.id}`);
  return updated;
}

export async function deleteComment(authorId: string, postId: string, id: string): Promise<void> {
  await findOwnedComment(authorId, postId, id, 'delete');

  await commentModel.softRemove(id);
  logger.info(`Comment deleted: id=${id}`);
}

async function assertPostExists(postId: string): Promise<void> {
  const post = await postModel.findById(postId);
  if (!post) throw new NotFoundError('Post not found');
}

async function findOwnedComment(
  authorId: string,
  postId: string,
  id: string,
  action: string,
): Promise<CommentEntity> {
  const comment = await commentModel.findById(id);

  if (!comment || comment.postId !== postId) throw new NotFoundError('Comment not found');

  if (comment.userId !== authorId)
    throw new ForbiddenError(`You can only ${action} your own comments`);

  return comment;
}
