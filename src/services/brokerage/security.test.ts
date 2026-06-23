import { describe, expect, it } from "vitest";
import { assertBrokerageConnectionOwnership, brokerageOwnershipWhere, safeBrokerageConnection } from "./security";

describe("brokerage security boundaries", () => {
  it("always includes user ID in connection ownership predicates", () => {
    expect(brokerageOwnershipWhere("user-1", "connection-1")).toEqual({ id: "connection-1", userId: "user-1" });
  });

  it("rejects attempts to reuse another user's provider item", () => {
    expect(() => assertBrokerageConnectionOwnership("user-2", "user-1")).toThrow("another user");
    expect(() => assertBrokerageConnectionOwnership("user-1", "user-1")).not.toThrow();
  });

  it("never includes encrypted or plaintext provider tokens in frontend data", () => {
    const safe = safeBrokerageConnection({
      id: "connection-1",
      provider: "plaid",
      institutionId: "institution-1",
      institutionName: "Test brokerage",
      institutionLogoUrl: null,
      status: "active",
      lastSyncedAt: null,
      createdAt: new Date("2026-01-01T00:00:00Z"),
      updatedAt: new Date("2026-01-01T00:00:00Z"),
      providerAccessTokenEncrypted: "encrypted-secret",
      accessToken: "plaintext-secret",
    } as never);
    expect(safe).not.toHaveProperty("providerAccessTokenEncrypted");
    expect(safe).not.toHaveProperty("accessToken");
  });
});
