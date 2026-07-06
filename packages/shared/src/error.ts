import { z } from "zod";

/** The shape every API error response takes. Success shapes have their own
 *  schemas (taskSchema, etc.); this is the agreed *failure* envelope. */
export const errorResponseSchema = z.object({ error: z.string() });
export type ApiError = z.infer<typeof errorResponseSchema>;
