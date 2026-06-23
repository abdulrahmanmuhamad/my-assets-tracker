import { describe, expect, it } from "vitest";
import { assertBankConnectionOwnership, bankAccountOwnershipWhere, bankOwnershipWhere, safeBankConnection } from "./security";

describe("bank security boundaries", () => {
  it("scopes connection lookups by authenticated user", () => {
    expect(bankOwnershipWhere("user-1", "bank-1")).toEqual({ id: "bank-1", userId: "user-1" });
    expect(bankAccountOwnershipWhere("user-1", "account-1")).toEqual({ id: "account-1", userId: "user-1" });
    expect(() => assertBankConnectionOwnership("user-2", "user-1")).toThrow("another user");
  });

  it("never serializes provider tokens or transaction cursors", () => {
    const safe = safeBankConnection({
      id: "bank-1", provider: "plaid", institutionId: "ins-1", institutionName: "Sandbox Bank",
      institutionLogoUrl: null, status: "active", productsEnabled: ["auth"], syncWarning: null,
      lastSyncedAt: null, createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"),
      providerAccessTokenEncrypted: "encrypted", accessToken: "plain", transactionsCursor: "cursor",
    } as never);
    expect(safe).not.toHaveProperty("providerAccessTokenEncrypted");
    expect(safe).not.toHaveProperty("accessToken");
    expect(safe).not.toHaveProperty("transactionsCursor");
  });
});
