import { afterEach, describe, expect, it } from "vitest";
import { jsonError } from "./api";
import {
  disabledFeatureForApiPath,
  FeatureDisabledError,
  isBanksFeatureEnabled,
  isPlaidFeatureEnabled,
  isStocksFeatureEnabled,
  requireBanksFeatureEnabled,
  requireStocksFeatureEnabled,
} from "./features";

const original = {
  plaid: process.env.ENABLE_PLAID_FEATURES,
  stocks: process.env.NEXT_PUBLIC_ENABLE_STOCKS_FEATURE,
  banks: process.env.NEXT_PUBLIC_ENABLE_BANKS_FEATURE,
};

afterEach(() => {
  for (const [key, value] of Object.entries({
    ENABLE_PLAID_FEATURES: original.plaid,
    NEXT_PUBLIC_ENABLE_STOCKS_FEATURE: original.stocks,
    NEXT_PUBLIC_ENABLE_BANKS_FEATURE: original.banks,
  })) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("provider feature gates", () => {
  it("keeps SimpleFIN banks and SnapTrade stocks available while Plaid remains opt-in", () => {
    delete process.env.ENABLE_PLAID_FEATURES;
    delete process.env.NEXT_PUBLIC_ENABLE_STOCKS_FEATURE;
    delete process.env.NEXT_PUBLIC_ENABLE_BANKS_FEATURE;
    expect(isPlaidFeatureEnabled()).toBe(false);
    expect(isStocksFeatureEnabled()).toBe(true);
    expect(isBanksFeatureEnabled()).toBe(true);

    process.env.ENABLE_PLAID_FEATURES = "true";
    process.env.NEXT_PUBLIC_ENABLE_STOCKS_FEATURE = "true";
    expect(isStocksFeatureEnabled()).toBe(true);
    expect(isBanksFeatureEnabled()).toBe(true);
  });

  it("does not block the replacement provider APIs when Plaid is disabled", () => {
    process.env.ENABLE_PLAID_FEATURES = "false";
    process.env.NEXT_PUBLIC_ENABLE_STOCKS_FEATURE = "false";
    process.env.NEXT_PUBLIC_ENABLE_BANKS_FEATURE = "false";
    expect(disabledFeatureForApiPath("/api/stocks")).toBeNull();
    expect(disabledFeatureForApiPath("/api/brokerage/sync/abc")).toBeNull();
    expect(disabledFeatureForApiPath("/api/banks/simplefin/connect")).toBeNull();
    expect(disabledFeatureForApiPath("/api/market-indexes/^GSPC")).toBeNull();
    expect(() => requireStocksFeatureEnabled()).not.toThrow();
    expect(() => requireBanksFeatureEnabled()).not.toThrow();
  });

  it("returns the required stable disabled-feature response", async () => {
    const response = jsonError(new FeatureDisabledError());
    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "FEATURE_DISABLED", message: "This feature is coming soon." });
  });
});
