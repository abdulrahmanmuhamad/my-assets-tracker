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
export const phoneSchema = z
  .string()
  .trim()
  .max(30, "Phone number must be 30 characters or fewer")
  .refine((value) => !value || /^[+()\-\d\s.]+$/.test(value), "Use a valid phone number")
  .refine((value) => !value || value.replace(/\D/g, "").length >= 7, "Phone number must include at least 7 digits");

export const profileUpdateSchema = z.object({
  username: usernameSchema.optional(),
  displayName: displayNameSchema.optional(),
  phone: phoneSchema.optional(),
});

export function normalizeOptionalUsername(value: unknown) {
  const parsed = usernameSchema.safeParse(value);
  return parsed.success ? parsed.data : undefined;
}
