import { z } from 'zod';
export {
  createTaskBodySchema as CreateTaskBodySchema,
  updateTaskBodySchema as UpdateTaskBodySchema,
} from '@repo/shared';
export type {
  CreateTaskBody as CreateTaskBodyDto,
  UpdateTaskBody as UpdateTaskBodyDto,
} from '@repo/shared';

export const GetTasksQuerySchema = z.object({
  isCompleted: z
    .enum(['true', 'false'], { error: 'isCompleted must be "true" or "false"' })
    .transform((v) => v === 'true')
    .optional(),
});
export type GetTasksQueryDto = z.infer<typeof GetTasksQuerySchema>;
