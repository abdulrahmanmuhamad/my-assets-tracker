import { describe, expect, it } from "vitest";
import {
  calculateCreditCardDebt,
  calculateLiquidCash,
  calculateNetCashAfterDebt,
  defaultIncludeInLiquidCash,
} from "./calculations";

const accounts = [
  { accountType: "depository", accountSubtype: "checking", currentBalance: 1200, includeInLiquidCash: true, isDebtAccount: false },
  { accountType: "depository", accountSubtype: "savings", currentBalance: 800, includeInLiquidCash: true, isDebtAccount: false },
  { accountType: "depository", accountSubtype: "cd", currentBalance: 5000, includeInLiquidCash: false, isDebtAccount: false },
  { accountType: "credit", accountSubtype: "credit card", currentBalance: 450, includeInLiquidCash: false, isDebtAccount: true },
  { accountType: "loan", accountSubtype: "mortgage", currentBalance: 200000, includeInLiquidCash: false, isDebtAccount: false },
];

describe("bank balance calculations", () => {
  it("includes only eligible opted-in depository balances", () => {
    expect(calculateLiquidCash(accounts)).toBe(2000);
    expect(defaultIncludeInLiquidCash("depository", "checking")).toBe(true);
    expect(defaultIncludeInLiquidCash("depository", "cd")).toBe(false);
  });

  it("counts credit-card debt but excludes loans", () => {
    expect(calculateCreditCardDebt(accounts)).toBe(450);
    expect(calculateNetCashAfterDebt(accounts)).toBe(1550);
  });

  it("excludes null balances from every total", () => {
    const unavailable = [{ accountType: "depository", accountSubtype: "checking", currentBalance: null, includeInLiquidCash: true, isDebtAccount: false }];
    expect(calculateLiquidCash(unavailable)).toBe(0);
  });
});
