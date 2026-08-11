export const FEATURE_DISABLED_MESSAGE = "This feature is coming soon.";

export class FeatureDisabledError extends Error {
  status = 503;
  code = "FEATURE_DISABLED" as const;

  constructor() {
    super(FEATURE_DISABLED_MESSAGE);
    this.name = "FeatureDisabledError";
  }
}

export function isPlaidFeatureEnabled() {
  return process.env.ENABLE_PLAID_FEATURES === "true";
}

export function isStocksFeatureEnabled() {
  return true;
}

export function isBanksFeatureEnabled() {
  return true;
}

export function requirePlaidFeatureEnabled() {
  if (!isPlaidFeatureEnabled()) throw new FeatureDisabledError();
}

export function requireStocksFeatureEnabled() {
  if (!isStocksFeatureEnabled()) throw new FeatureDisabledError();
}

export function requireBanksFeatureEnabled() {
  if (!isBanksFeatureEnabled()) throw new FeatureDisabledError();
}

export function isAlertCategoryEnabled(category: string) {
  if (category === "stock") return isStocksFeatureEnabled();
  if (category === "bank" || category === "bank_account" || category === "bank_transaction") return isBanksFeatureEnabled();
  return true;
}

export function requireAlertCategoryEnabled(category: string) {
  if (!isAlertCategoryEnabled(category)) throw new FeatureDisabledError();
}

export function disabledFeatureForApiPath(pathname: string) {
  if (pathname === "/api/brokerage" || pathname.startsWith("/api/brokerage/")) {
    return isStocksFeatureEnabled() ? null : "stocks";
  }
  if (pathname === "/api/stocks" || pathname.startsWith("/api/stocks/")) {
    return isStocksFeatureEnabled() ? null : "stocks";
  }
  if (pathname === "/api/banks" || pathname.startsWith("/api/banks/")) {
    return isBanksFeatureEnabled() ? null : "banks";
  }
  return null;
}
