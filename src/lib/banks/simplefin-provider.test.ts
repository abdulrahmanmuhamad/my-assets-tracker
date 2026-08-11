import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeSimpleFinSetupToken,
  fetchSimpleFinSnapshot,
  normalizeSimpleFinPayload,
} from "./simplefin-provider";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("SimpleFIN provider", () => {
  it("rejects setup tokens that do not point to the official Bridge", () => {
    const malicious = Buffer.from("https://example.com/simplefin/claim/token").toString("base64");
    expect(() => decodeSimpleFinSetupToken(malicious)).toThrow("official SimpleFIN Bridge");
  });

  it("normalizes accounts and converts SimpleFIN signs to the portfolio convention", () => {
    const [connection] = normalizeSimpleFinPayload({
      connections: [{ conn_id: "connection-1", org_id: "bank-1", org_name: "Example Bank" }],
      accounts: [{
        id: "account-1",
        conn_id: "connection-1",
        name: "Everyday Checking",
        currency: "USD",
        balance: "1250.50",
        "available-balance": "1200.25",
        "balance-date": 1_767_225_600,
        extra: { "account-type": "checking", "last-four": "1234" },
        transactions: [
          { id: "deposit", posted: 1_767_225_600, amount: "500.00", description: "Paycheck" },
          { id: "purchase", posted: 1_767_312_000, amount: "-42.75", description: "Groceries" },
        ],
      }],
    });

    expect(connection.institutionName).toBe("Example Bank");
    expect(connection.sync.accounts[0]).toMatchObject({
      providerAccountId: "account-1",
      accountType: "depository",
      accountSubtype: "checking",
      mask: "1234",
      currentBalance: 1250.5,
    });
    expect(connection.sync.transactions).toEqual(expect.arrayContaining([
      expect.objectContaining({ providerTransactionId: "account-1:deposit", amount: -500, transactionType: "deposit" }),
      expect.objectContaining({ providerTransactionId: "account-1:purchase", amount: 42.75, transactionType: "withdrawal" }),
    ]));
  });

  it("keeps access credentials out of the request URL", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const requestUrl = String(input);
      expect(requestUrl).not.toContain("bridge-user");
      expect(requestUrl).not.toContain("bridge-password");
      expect(new Headers(init?.headers).get("authorization")).toBe(
        `Basic ${Buffer.from("bridge-user:bridge-password").toString("base64")}`,
      );
      return new Response(JSON.stringify({ connections: [], accounts: [] }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    await expect(fetchSimpleFinSnapshot(
      "https://bridge-user:bridge-password@bridge.simplefin.org/simplefin/access-token",
    )).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledOnce();
  });
});
