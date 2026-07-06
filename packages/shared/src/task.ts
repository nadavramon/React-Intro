import { z } from "zod";
import { TASK_TITLE_MIN_LENGTH, TASK_TITLE_MAX_LENGTH } from "./constants.ts";

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  isCompleted: z.boolean(),
});
export type Task = z.infer<typeof taskSchema>;

export const createTaskBodySchema = z.object({
  title: z
    .string({ error: "Title must be a string" })
    .trim()
    .min(TASK_TITLE_MIN_LENGTH, "Title must be a non-empty string")
    .max(
      TASK_TITLE_MAX_LENGTH,
      `Title is too long (maximum ${TASK_TITLE_MAX_LENGTH} characters)`,
    ),
  isCompleted: z.boolean({ error: "isCompleted must be a boolean" }).optional(),
});
export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;

export const updateTaskBodySchema = z
  .object({
    title: z
      .string({ error: "Title must be a string" })
      .trim()
      .min(TASK_TITLE_MIN_LENGTH, "Title must be a non-empty string")
      .max(
        TASK_TITLE_MAX_LENGTH,
        `Title is too long (maximum ${TASK_TITLE_MAX_LENGTH} characters)`,
      )
      .optional(),
    isCompleted: z
      .boolean({ error: "isCompleted must be a boolean" })
      .optional(),
  })
  .refine(
    (data) => data.title !== undefined || data.isCompleted !== undefined,
    {
      message: "Please provide either a title or isCompleted status to update",
    },
  );
export type UpdateTaskBody = z.infer<typeof updateTaskBodySchema>;
