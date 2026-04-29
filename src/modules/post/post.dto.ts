import { z } from 'zod';

export const CreatePostBodySchema = z.object({
  title: z
    .string({ error: 'Title must be a string' })
    .trim()
    .min(1, 'Title must be a non-empty string')
    .max(255, 'Title is too long (maximum 255 characters)'),
  content: z
    .string({ error: 'Content must be a string' })
    .trim()
    .min(1, 'Content must be a non-empty string')
    .max(10000, 'Content is too long (maximum 10000 characters)'),
});
export type CreatePostBodyDto = z.infer<typeof CreatePostBodySchema>;

export const UpdatePostBodySchema = z
  .object({
    title: z
      .string({ error: 'Title must be a string' })
      .trim()
      .min(1, 'Title must be a non-empty string')
      .max(255, 'Title is too long (maximum 255 characters)')
      .optional(),
    content: z
      .string({ error: 'Content must be a string' })
      .trim()
      .min(1, 'Content must be a non-empty string')
      .max(10000, 'Content is too long (maximum 10000 characters)')
      .optional(),
  })
  .refine((data) => data.title !== undefined || data.content !== undefined, {
    message: 'Please provide either title or content to update',
  });
export type UpdatePostBodyDto = z.infer<typeof UpdatePostBodySchema>;

export const GetPostsQuerySchema = z.object({
  userId: z
    .string({ error: 'userId must be a string' })
    .regex(/^[a-fA-F0-9]{24}$/, 'userId must be a valid Mongo ObjectId')
    .optional(),
});
export type GetPostsQueryDto = z.infer<typeof GetPostsQuerySchema>;
