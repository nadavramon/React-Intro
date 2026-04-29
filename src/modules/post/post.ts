export interface PostEntity {
  id: string;
  userId: string;
  title: string;
  content: string;
  likesCount: number;
  createdAt: Date;
  updatedAt: Date;
}
