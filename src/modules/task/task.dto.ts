import { z } from 'zod';

export const CreateTaskBodySchema = z.object({
  title: z
    .string({ error: 'Title must be a string' })
    .trim()
    .min(1, 'Title must be a non-empty string')
    .max(255, 'Title is too long (maximum 255 characters)'),
  isCompleted: z.boolean({ error: 'isCompleted must be a boolean' }).optional(),
});
export type CreateTaskBodyDto = z.infer<typeof CreateTaskBodySchema>;

export const UpdateTaskBodySchema = z
  .object({
    title: z
      .string({ error: 'Title must be a string' })
      .trim()
      .min(1, 'Title must be a non-empty string')
      .max(255, 'Title is too long (maximum 255 characters)')
      .optional(),
    isCompleted: z.boolean({ error: 'isCompleted must be a boolean' }).optional(),
  })
  .refine((data) => data.title !== undefined || data.isCompleted !== undefined, {
    message: 'Please provide either a title or isCompleted status to update',
  });
export type UpdateTaskBodyDto = z.infer<typeof UpdateTaskBodySchema>;

export const GetTasksQuerySchema = z.object({
  isCompleted: z
    .enum(['true', 'false'], { error: 'isCompleted must be "true" or "false"' })
    .transform((v) => v === 'true')
    .optional(),
});
export type GetTasksQueryDto = z.infer<typeof GetTasksQuerySchema>;
