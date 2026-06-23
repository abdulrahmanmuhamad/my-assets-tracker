import { afterEach, describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret } from "./encryption";

const originalKey = process.env.TOKEN_ENCRYPTION_KEY;

afterEach(() => {
  process.env.TOKEN_ENCRYPTION_KEY = originalKey;
});

describe("provider token encryption", () => {
  it("encrypts with AES-GCM and decrypts only with the configured key", () => {
    process.env.TOKEN_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
    const encrypted = encryptSecret("sandbox-access-token");
    expect(encrypted).toMatch(/^v1:/);
    expect(encrypted).not.toContain("sandbox-access-token");
    expect(decryptSecret(encrypted)).toBe("sandbox-access-token");
  });
});
