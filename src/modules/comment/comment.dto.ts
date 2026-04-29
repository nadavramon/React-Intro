import { z } from 'zod';

export const CreateCommentBodySchema = z.object({
  content: z
    .string({ error: 'Comment must be a string' })
    .trim()
    .min(1, 'Comment must be a non-empty string')
    .max(1000, 'Comment is too long (maximum 1000 characters)'),
});
export type CreateCommentBodyDto = z.infer<typeof CreateCommentBodySchema>;
