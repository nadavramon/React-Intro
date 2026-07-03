import { z } from "zod";

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
    .min(1, "Title must be a non-empty string")
    .max(255, "Title is too long (maximum 255 characters)"),
  isCompleted: z.boolean({ error: "isCompleted must be a boolean" }).optional(),
});
export type CreateTaskBody = z.infer<typeof createTaskBodySchema>;

export const updateTaskBodySchema = z
  .object({
    title: z
      .string({ error: "Title must be a string" })
      .trim()
      .min(1, "Title must be a non-empty string")
      .max(255, "Title is too long (maximum 255 characters)")
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
