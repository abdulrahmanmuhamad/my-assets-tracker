import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { profileUpdateSchema, usernameSchema } from "./user-access";

describe("username validation", () => {
  it("normalizes valid usernames for case-insensitive uniqueness", () => {
    expect(usernameSchema.parse("  Portfolio-Owner_7 ")).toBe("portfolio-owner_7");
  });

  it("rejects spaces, punctuation, and invalid lengths", () => {
    for (const value of ["ab", "has space", "not.allowed", "a".repeat(31)]) {
      expect(usernameSchema.safeParse(value).success).toBe(false);
    }
  });

  it("limits profile updates to editable profile fields", () => {
    const result = profileUpdateSchema.parse({ username: "Valid_User", displayName: "Valid User", email: "changed@example.com" });
    expect(result).toEqual({ username: "valid_user", displayName: "Valid User" });
  });

  it("allows phone-only profile updates", () => {
    expect(profileUpdateSchema.parse({ phone: " +1 (555) 123-4567 " })).toEqual({ phone: "+1 (555) 123-4567" });
    expect(profileUpdateSchema.safeParse({ phone: "call me" }).success).toBe(false);
  });

  it("backs normalized usernames with a database unique constraint", () => {
    const schema = readFileSync(resolve(process.cwd(), "prisma/schema.prisma"), "utf8");
    const migration = readFileSync(resolve(process.cwd(), "prisma/migrations/20260622090000_user_access_approval/migration.sql"), "utf8");
    expect(schema).toMatch(/username\s+String\?\s+@unique/);
    expect(migration).toContain('CHECK ("username" IS NULL OR "username" = LOWER("username"))');
  });
});
