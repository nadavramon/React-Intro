import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "user"]);
export type UserRole = z.infer<typeof userRoleSchema>;

// ponytail: contract-completeness — required by the assignment's shared-types list.
// Neither app consumes `User` yet; it's the public projection of the server's UserEntity (no password).
export const userPublicSchema = z.object({
  id: z.string(),
  email: z.email(),
  role: userRoleSchema,
});
export type User = z.infer<typeof userPublicSchema>;
