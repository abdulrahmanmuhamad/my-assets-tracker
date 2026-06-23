import { describe, expect, it } from "vitest";
import { calculatePortfolioWithOptionalCash } from "./portfolio";

const assets = [{ id: "gold", name: "Gold", category: "Minerals", subType: "Gold", purchaseDate: "2026-01-01", purchasePrice: 100, currentValue: 125, roiPercent: 25 }];

describe("portfolio cash integration", () => {
  it("excludes cash by default", () => {
    const result = calculatePortfolioWithOptionalCash(assets, 1000, false);
    expect(result.selected.totalPortfolioValue).toBe(125);
    expect(result.selected.allocationByCategory.map((item) => item.name)).not.toContain("Banks/Cash");
  });

  it("includes liquid cash at face value when enabled", () => {
    const result = calculatePortfolioWithOptionalCash(assets, 1000, true);
    expect(result.selected.totalPortfolioValue).toBe(1125);
    expect(result.selected.totalCostBasis).toBe(1100);
    expect(result.selected.totalProfitLoss).toBe(25);
    expect(result.selected.totalRoiPercent).toBe(result.withoutCash.totalRoiPercent);
    expect(result.selected.allocationByCategory.map((item) => item.name)).toContain("Banks/Cash");
  });

  it("has no debt input, so credit-card debt can never increase portfolio value", () => {
    expect(calculatePortfolioWithOptionalCash(assets, 0, true).selected.totalPortfolioValue).toBe(125);
  });
});
