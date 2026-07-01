import { z } from "zod";

export const loginBodySchema = z.object({
  email: z.email({ error: "Invalid email address" }),
  password: z
    .string({ error: "Password must be a string" })
    .min(1, "Password is required"),
});
export type LoginBody = z.infer<typeof loginBodySchema>;

export const authTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});
export type AuthTokens = z.infer<typeof authTokensSchema>;
