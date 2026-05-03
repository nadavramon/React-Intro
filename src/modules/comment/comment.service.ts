import { CommentEntity } from './comment.entity.ts';
import { CommentModel, CommentDoc } from './comment.schema.ts';
import { PostModel } from '../post/post.schema.ts';
import { CreateCommentBodyDto, UpdateCommentBodyDto } from './comment.dto.ts';
import { NotFoundError, ForbiddenError } from '../../shared/errors/AppError.ts';
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
  await findOwnedComment(authorId, postId, id, 'edit');

  const doc = (await CommentModel.findOneAndUpdate({ _id: id, isDeleted: false }, dto, {
    new: true,
  }).lean())!;
  logger.info(`Comment updated: id=${id}`);
  return toComment(doc);
}

export async function deleteComment(authorId: string, postId: string, id: string): Promise<void> {
  await findOwnedComment(authorId, postId, id, 'delete');

  await CommentModel.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
  logger.info(`Comment deleted: id=${id}`);
}

async function assertPostExists(postId: string): Promise<void> {
  const exists = await PostModel.exists({ _id: postId, isDeleted: false });
  if (!exists) throw new NotFoundError('Post not found');
}

async function findOwnedComment(
  authorId: string,
  postId: string,
  id: string,
  action: string,
): Promise<CommentEntity> {
  const doc = await CommentModel.findOne({ _id: id, isDeleted: false }).lean();

  if (!doc || doc.postId.toString() !== postId) throw new NotFoundError('Comment not found');

  if (doc.userId.toString() !== authorId)
    throw new ForbiddenError(`You can only ${action} your own comments`);

  return toComment(doc);
}
