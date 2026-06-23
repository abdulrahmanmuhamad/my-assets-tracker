import { describe, expect, it } from "vitest";
import { inspectPlaidBankingConfiguration, inspectPlaidConfiguration } from "./config";

describe("Plaid configuration", () => {
  it("reports every missing required local setting", () => {
    const result = inspectPlaidConfiguration({ PLAID_ENV: "sandbox" });
    expect(result.configured).toBe(false);
    expect(result.issues.join(" ")).toContain("PLAID_CLIENT_ID");
    expect(result.issues.join(" ")).toContain("PLAID_SECRET");
    expect(result.issues.join(" ")).toContain("TOKEN_ENCRYPTION_KEY");
  });

  it("validates banking products separately from brokerage readiness", () => {
    const environment = {
      PLAID_CLIENT_ID: "client-id", PLAID_SECRET: "sandbox-secret", PLAID_ENV: "sandbox",
      PLAID_PRODUCTS: "investments", PLAID_COUNTRY_CODES: "US",
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    };
    expect(inspectPlaidConfiguration(environment).configured).toBe(true);
    expect(inspectPlaidBankingConfiguration(environment).configured).toBe(false);
    expect(inspectPlaidBankingConfiguration({ ...environment, PLAID_PRODUCTS: "investments,auth,transactions,liabilities" }).configured).toBe(true);
  });

  it("accepts a complete Sandbox configuration", () => {
    const result = inspectPlaidConfiguration({
      PLAID_CLIENT_ID: "client-id",
      PLAID_SECRET: "sandbox-secret",
      PLAID_ENV: "sandbox",
      PLAID_PRODUCTS: "investments",
      PLAID_COUNTRY_CODES: "US",
      PLAID_REDIRECT_URI: "http://localhost:3001/stocks",
      TOKEN_ENCRYPTION_KEY: Buffer.alloc(32, 1).toString("base64"),
    });
    expect(result.configured).toBe(true);
    expect(result.issues).toEqual([]);
  });
});
