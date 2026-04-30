import { PostEntity } from './post.ts';
import { PostModel, PostDoc } from './postSchema.ts';

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

export async function findAll(filter: { userId?: string } = {}): Promise<PostEntity[]> {
  const query: { isDeleted: boolean; userId?: string } = { isDeleted: false };

  if (filter.userId) query.userId = filter.userId;

  const docs = await PostModel.find(query).sort({ createdAt: -1 }).lean();

  return docs.map(toPost);
}

export async function findById(id: string): Promise<PostEntity | null> {
  const doc = await PostModel.findOne({ _id: id, isDeleted: false }).lean();
  return doc ? toPost(doc) : null;
}

export type CreatePostInput = Pick<PostEntity, 'userId' | 'title' | 'content'>;

export async function create(input: CreatePostInput): Promise<PostEntity> {
  const doc = await PostModel.create(input);
  return toPost(doc.toObject());
}

type EditableFields = Pick<PostEntity, 'title' | 'content'>;
export type UpdatePostInput = Partial<EditableFields>;

export async function update(id: string, data: UpdatePostInput): Promise<PostEntity | null> {
  const doc = await PostModel.findOneAndUpdate({ _id: id, isDeleted: false }, data, {
    new: true,
  }).lean();
  return doc ? toPost(doc) : null;
}

export async function softRemove(id: string): Promise<PostEntity | null> {
  const doc = await PostModel.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true, deletedAt: new Date() },
    { new: true },
  ).lean();
  return doc ? toPost(doc) : null;
}

export async function incrementLikes(id: string): Promise<PostEntity | null> {
  const doc = await PostModel.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { $inc: { likesCount: 1 } },
    { new: true },
  ).lean();
  return doc ? toPost(doc) : null;
}
