import { CommentEntity } from './comment.entity.ts';
import { CommentModel, CommentDoc } from './comment.schema.ts';
import { assertPostExists } from '../post/post.service.ts';
import { CreateCommentBodyDto, UpdateCommentBodyDto } from './comment.dto.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
import { logger } from '../../shared/utils/logger.ts';

function toComment(doc: CommentDoc): CommentEntity {
  return {
    id: doc._id.toString(),
    postId: doc.postId.toString(),
    userId: doc.userId.toString(),
    content: doc.content,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export async function getCommentsByPost(postId: string): Promise<CommentEntity[]> {
  await assertPostExists(postId);

  const docs = await CommentModel.find({ postId, isDeleted: false }).sort({ createdAt: -1 }).lean();
  return docs.map(toComment);
}

export async function createComment(
  authorId: string,
  postId: string,
  dto: CreateCommentBodyDto,
): Promise<CommentEntity> {
  await assertPostExists(postId);

  const doc = await CommentModel.create({
    postId,
    userId: authorId,
    content: dto.content,
  });
  const comment = toComment(doc.toObject());
  logger.info(`Comment created: id=${comment.id}, postId=${comment.postId}`);
  return comment;
}

export async function updateComment(
  authorId: string,
  postId: string,
  id: string,
  dto: UpdateCommentBodyDto,
): Promise<CommentEntity> {
  const doc = await CommentModel.findOneAndUpdate(
    { _id: id, isDeleted: false, postId, userId: authorId },
    dto,
    { returnDocument: 'after' },
  ).lean();
  if (!doc) throw new NotFoundError('Comment not found');

  logger.info(`Comment updated: id=${id}`);
  return toComment(doc);
}

export async function deleteComment(authorId: string, postId: string, id: string): Promise<void> {
  const doc = await CommentModel.findOneAndUpdate(
    { _id: id, isDeleted: false, postId, userId: authorId },
    { isDeleted: true, deletedAt: new Date() },
  ).lean();
  if (!doc) throw new NotFoundError('Comment not found');

  logger.info(`Comment deleted: id=${id}`);
}
