import { describe, expect, it } from "vitest";
import { ASSET_CATEGORIES } from "./constants";
import { calculatePortfolioSummary } from "./calculations";

describe("portfolio ownership boundaries", () => {
  it("includes owned asset classes but excludes market indexes from portfolio totals", () => {
    expect(ASSET_CATEGORIES).toEqual(["Minerals", "Real Estate", "Jewelry", "Stocks"]);
    expect(ASSET_CATEGORIES).not.toContain("Market Indexes");

    const summary = calculatePortfolioSummary([
      { id: "m", name: "Gold", category: "Minerals", subType: "Gold", purchaseDate: "2026-01-01", purchasePrice: 100, currentValue: 120, roiPercent: 20 },
      { id: "s", name: "Stock", category: "Stocks", subType: "Broker", purchaseDate: "2026-01-01", purchasePrice: 200, currentValue: 240, roiPercent: 20 },
    ]);
    expect(summary.totalPortfolioValue).toBe(360);
  });
});
