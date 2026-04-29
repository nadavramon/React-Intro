import { CommentEntity } from './comment.ts';
import { CommentModel, CommentDoc } from './commentSchema.ts';

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

export async function findByPostId(postId: string): Promise<CommentEntity[]> {
  const docs = await CommentModel.find({ postId, isDeleted: false }).sort({ createdAt: -1 }).lean();

  return docs.map(toComment);
}

export async function findById(id: string): Promise<CommentEntity | null> {
  const doc = await CommentModel.findOne({ _id: id, isDeleted: false }).lean();
  return doc ? toComment(doc) : null;
}

export type CreateCommentInput = Pick<CommentEntity, 'postId' | 'userId' | 'content'>;

export async function create(input: CreateCommentInput): Promise<CommentEntity> {
  const doc = await CommentModel.create(input);
  return toComment(doc.toObject());
}

export async function softRemove(id: string): Promise<CommentEntity | null> {
  const doc = await CommentModel.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true },
  ).lean();
  return doc ? toComment(doc) : null;
}

export async function softRemoveByPostId(postId: string): Promise<void> {
  await CommentModel.updateMany(
    { postId, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
  );
}

export type UpdateCommentInput = Pick<CommentEntity, 'content'>;

export async function update(id: string, data: UpdateCommentInput): Promise<CommentEntity | null> {
  const doc = await CommentModel.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    new: true,
  }).lean();
  return doc ? toComment(doc) : null;
}
