import { describe, expect, it } from "vitest";
import { maskForKind, resolveSensitiveHidden } from "./privacy";
import { settingsSchema } from "./validators";

describe("financial privacy and display settings", () => {
  it("hides financial values by default", () => {
    expect(settingsSchema.parse({
      defaultCurrency: "USD", preferredMineralUnit: "gram", preferredJewelryWeightUnit: "gram",
      livePriceProvider: "yahoo", manualPriceOverrides: {}, dashboardVisibility: {}, theme: "system",
    }).financialValuesHiddenByDefault).toBe(true);
    expect(maskForKind("currency")).toBe("$••••••");
  });

  it("supports temporary reveal and hide overrides", () => {
    expect(resolveSensitiveHidden(true, null)).toBe(true);
    expect(resolveSensitiveHidden(true, false)).toBe(false);
    expect(resolveSensitiveHidden(false, true)).toBe(true);
  });

  it("persists light, dark, and system theme values through validation", () => {
    const base = { defaultCurrency: "USD", preferredMineralUnit: "gram", preferredJewelryWeightUnit: "gram", livePriceProvider: "yahoo", manualPriceOverrides: {}, dashboardVisibility: {}, includeLiquidCashInPortfolio: false, financialValuesHiddenByDefault: true };
    expect(settingsSchema.parse({ ...base, theme: "dark" }).theme).toBe("dark");
    expect(settingsSchema.parse({ ...base, theme: "system" }).theme).toBe("system");
  });
});
