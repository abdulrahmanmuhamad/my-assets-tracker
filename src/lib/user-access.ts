import { z } from "zod";

export const USERNAME_PATTERN = /^[a-z0-9_-]+$/;

export const usernameSchema = z
  .string()
  .trim()
  .min(3, "Username must be at least 3 characters")
  .max(30, "Username must be 30 characters or fewer")
  .transform((value) => value.toLowerCase())
  .refine((value) => USERNAME_PATTERN.test(value), "Use only letters, numbers, underscores, or hyphens");

export const displayNameSchema = z.string().trim().max(80, "Display name must be 80 characters or fewer");

export const profileUpdateSchema = z.object({
  username: usernameSchema,
  displayName: displayNameSchema.optional().default(""),
});

export function normalizeOptionalUsername(value: unknown) {
  const parsed = usernameSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
