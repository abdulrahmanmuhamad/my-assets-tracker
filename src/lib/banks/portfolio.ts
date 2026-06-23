import { calculatePortfolioSummary, type PortfolioAsset } from "@/lib/calculations";

export function calculatePortfolioWithOptionalCash(
  assets: PortfolioAsset[],
  liquidCash: number,
  includeLiquidCash: boolean,
) {
  const withoutCash = calculatePortfolioSummary(assets);
  const cashAsset: PortfolioAsset = {
    id: "banks-liquid-cash",
    name: "Liquid cash",
    category: "Banks/Cash",
    subType: "Depository accounts",
    purchaseDate: "",
    purchasePrice: liquidCash,
    currentValue: liquidCash,
    roiPercent: 0,
  };
  const withCash = calculatePortfolioSummary(liquidCash > 0 ? [...assets, cashAsset] : assets);
  const selected = includeLiquidCash ? { ...withCash, totalRoiPercent: withoutCash.totalRoiPercent } : withoutCash;
  return { selected, withCash, withoutCash };
}
