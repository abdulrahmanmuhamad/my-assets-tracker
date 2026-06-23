import type { BankSummaryAccount } from "./types";

const DEFAULT_LIQUID_SUBTYPES = new Set(["checking", "savings", "money market", "cash management"]);

export function defaultIncludeInLiquidCash(accountType: string, accountSubtype?: string | null) {
  return accountType.toLowerCase() === "depository" && DEFAULT_LIQUID_SUBTYPES.has((accountSubtype || "").toLowerCase());
}

export function isCreditCardAccount(accountType: string, accountSubtype?: string | null) {
  const type = accountType.toLowerCase();
  const subtype = (accountSubtype || "").toLowerCase();
  return type === "credit" && (subtype === "credit card" || subtype === "credit");
}

export function calculateLiquidCash(accounts: BankSummaryAccount[]) {
  return accounts.reduce((total, account) => {
    if (account.accountType.toLowerCase() !== "depository" || !account.includeInLiquidCash) return total;
    return account.currentBalance === null || account.currentBalance === undefined ? total : total + account.currentBalance;
  }, 0);
}

export function calculateCreditCardDebt(accounts: BankSummaryAccount[]) {
  return accounts.reduce((total, account) => {
    if (!account.isDebtAccount && !isCreditCardAccount(account.accountType, account.accountSubtype)) return total;
    if (account.currentBalance === null || account.currentBalance === undefined) return total;
    return total + Math.max(0, account.currentBalance);
  }, 0);
}

export function calculateNetCashAfterDebt(accounts: BankSummaryAccount[]) {
  return calculateLiquidCash(accounts) - calculateCreditCardDebt(accounts);
}

export function calculateBankSummary(accounts: BankSummaryAccount[]) {
  const liquidCash = calculateLiquidCash(accounts);
  const creditCardDebt = calculateCreditCardDebt(accounts);
  return { liquidCash, creditCardDebt, netCashAfterDebt: liquidCash - creditCardDebt, accountCount: accounts.length };
}

export const calculateAllBanksSummary = calculateBankSummary;
