export const TROY_OUNCE_GRAMS = 31.1034768;

const UNIT_TO_GRAMS: Record<string, number> = {
  gram: 1,
  kilogram: 1000,
  ounce: 28.349523125,
  "troy ounce": TROY_OUNCE_GRAMS,
  pound: 453.59237,
};

type NumericLike = number | string | null | undefined | { toNumber: () => number };

export type Expenses = {
  maintenance?: NumericLike;
  tax?: NumericLike;
  insurance?: NumericLike;
  management?: NumericLike;
  hoa?: NumericLike;
  other?: NumericLike;
};

export type RealEstateCalculationInput = {
  estimatedCurrentPrice: NumericLike;
  purchasePrice?: NumericLike;
  isPaidOff?: boolean;
  remainingBalance?: NumericLike;
  monthlyPayment?: NumericLike;
  monthsLeft?: NumericLike;
  isRented?: boolean;
  monthlyRent?: NumericLike;
  monthlyExpenses?: Expenses | null;
};

export type JewelryCalculationInput = {
  jewelryType: string;
  purchasePrice?: NumericLike;
  estimatedPriceNow?: NumericLike;
  weightInGrams: NumericLike;
  pricePerGram?: NumericLike;
  karat?: NumericLike;
  purityPercent?: NumericLike;
};

export type PortfolioAsset = {
  id: string;
  name: string;
  category: string;
  subType: string;
  purchaseDate: string | Date;
  purchasePrice: NumericLike;
  currentValue: NumericLike;
  roiPercent: NumericLike;
};

export type StockHoldingCalculationInput = {
  id?: string;
  brokerName?: string;
  accountName?: string;
  symbol?: string | null;
  securityName?: string | null;
  quantity: NumericLike;
  costBasis?: NumericLike;
  currentPrice?: NumericLike;
  marketValue?: NumericLike;
  unrealizedGainLoss?: NumericLike;
  unrealizedGainLossPercent?: NumericLike;
};

export function toNumber(value: NumericLike): number {
  if (value === null || value === undefined || value === "") {
    return 0;
  }

  if (typeof value === "object" && "toNumber" in value) {
    return value.toNumber();
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function roundCurrency(value: NumericLike): number {
  return Math.round(toNumber(value) * 100) / 100;
}

export function roundPercent(value: NumericLike): number {
  return Math.round(toNumber(value) * 10000) / 10000;
}

export function convertToGrams(quantity: NumericLike, unit: string): number {
  const factor = UNIT_TO_GRAMS[unit];
  if (!factor) {
    throw new Error(`Unsupported unit: ${unit}`);
  }

  return toNumber(quantity) * factor;
}

export function convertFromGrams(quantityInGrams: NumericLike, targetUnit: string): number {
  const factor = UNIT_TO_GRAMS[targetUnit];
  if (!factor) {
    throw new Error(`Unsupported unit: ${targetUnit}`);
  }

  return toNumber(quantityInGrams) / factor;
}

export function calculateROI(currentValue: NumericLike, purchasePrice: NumericLike): number {
  const cost = toNumber(purchasePrice);
  if (cost <= 0) {
    return 0;
  }

  return roundPercent(((toNumber(currentValue) - cost) / cost) * 100);
}

export function calculateMineralCurrentValue(quantityInGrams: NumericLike, pricePerGram: NumericLike): number {
  return roundCurrency(toNumber(quantityInGrams) * toNumber(pricePerGram));
}

export function calculateGoldPurity(karat: NumericLike): number {
  const parsed = toNumber(karat);
  if (parsed <= 0) {
    return 0;
  }

  return Math.min(parsed, 24) / 24;
}

export function calculateJewelryCurrentValue(item: JewelryCalculationInput): number {
  const manualEstimate = toNumber(item.estimatedPriceNow);
  if (manualEstimate > 0) {
    return roundCurrency(manualEstimate);
  }

  const weightInGrams = toNumber(item.weightInGrams);
  const pricePerGram = toNumber(item.pricePerGram);
  const type = item.jewelryType.toLowerCase();

  if (type === "gold") {
    const purity = calculateGoldPurity(item.karat);
    return roundCurrency(weightInGrams * purity * pricePerGram);
  }

  if (type === "silver") {
    const purity = toNumber(item.purityPercent) > 1 ? toNumber(item.purityPercent) / 100 : toNumber(item.purityPercent);
    return roundCurrency(weightInGrams * purity * pricePerGram);
  }

  return roundCurrency(weightInGrams * pricePerGram);
}

export function calculateRealEstateROI(property: RealEstateCalculationInput): number {
  return calculateROI(property.estimatedCurrentPrice, property.purchasePrice);
}

export function calculateEquity(property: RealEstateCalculationInput): number {
  const currentValue = toNumber(property.estimatedCurrentPrice);
  if (property.isPaidOff) {
    return roundCurrency(currentValue);
  }

  const providedBalance = toNumber(property.remainingBalance);
  const estimatedBalance = providedBalance > 0 ? providedBalance : toNumber(property.monthlyPayment) * toNumber(property.monthsLeft);
  return roundCurrency(currentValue - estimatedBalance);
}

export function sumMonthlyExpenses(expenses?: Expenses | null): number {
  if (!expenses) {
    return 0;
  }

  return roundCurrency(
    Object.values(expenses).reduce<number>((sum, value) => sum + toNumber(value), 0),
  );
}

export function calculateMonthlyNetCashFlow(property: RealEstateCalculationInput): number {
  const rent = property.isRented ? toNumber(property.monthlyRent) : 0;
  const debtService = property.isPaidOff ? 0 : toNumber(property.monthlyPayment);
  const expenses = sumMonthlyExpenses(property.monthlyExpenses);
  return roundCurrency(rent - debtService - expenses);
}

export function calculatePortfolioSummary(allAssets: PortfolioAsset[]) {
  const totalPortfolioValue = roundCurrency(allAssets.reduce((sum, item) => sum + toNumber(item.currentValue), 0));
  const totalCostBasis = roundCurrency(allAssets.reduce((sum, item) => sum + toNumber(item.purchasePrice), 0));
  const totalProfitLoss = roundCurrency(totalPortfolioValue - totalCostBasis);
  const totalRoiPercent = calculateROI(totalPortfolioValue, totalCostBasis);

  const addAllocation = (key: "category" | "subType") =>
    Object.values(
      allAssets.reduce<Record<string, { name: string; value: number; cost: number; roiPercent: number; percentOfTotal: number }>>(
        (acc, item) => {
          const name = item[key] || "Other";
          acc[name] ||= { name, value: 0, cost: 0, roiPercent: 0, percentOfTotal: 0 };
          acc[name].value += toNumber(item.currentValue);
          acc[name].cost += toNumber(item.purchasePrice);
          return acc;
        },
        {},
      ),
    )
      .map((item) => ({
        ...item,
        value: roundCurrency(item.value),
        cost: roundCurrency(item.cost),
        roiPercent: calculateROI(item.value, item.cost),
        percentOfTotal: totalPortfolioValue > 0 ? roundPercent((item.value / totalPortfolioValue) * 100) : 0,
      }))
      .sort((a, b) => b.value - a.value);

  return {
    totalPortfolioValue,
    totalCostBasis,
    totalProfitLoss,
    totalRoiPercent,
    allocationByCategory: addAllocation("category"),
    allocationBySubtype: addAllocation("subType"),
  };
}

export function calculateHoldingMarketValue(quantity: NumericLike, currentPrice: NumericLike): number {
  return roundCurrency(toNumber(quantity) * toNumber(currentPrice));
}

export function calculateHoldingGainLoss(marketValue: NumericLike, costBasis: NumericLike): number {
  return roundCurrency(toNumber(marketValue) - toNumber(costBasis));
}

export function calculateHoldingROI(marketValue: NumericLike, costBasis: NumericLike): number | null {
  const cost = toNumber(costBasis);
  if (cost <= 0) return null;
  return roundPercent(((toNumber(marketValue) - cost) / cost) * 100);
}

function hasKnownCostBasis(value: NumericLike) {
  return value !== null && value !== undefined && value !== "" && toNumber(value) > 0;
}

function addStockAllocation(
  holdings: StockHoldingCalculationInput[],
  totalValue: number,
  key: "brokerName" | "accountName" | "symbol",
) {
  return Object.values(
    holdings.reduce<Record<string, { name: string; value: number; costBasis: number; knownCostCount: number }>>(
      (acc, holding) => {
        const name = String(holding[key] || "Unassigned");
        acc[name] ||= { name, value: 0, costBasis: 0, knownCostCount: 0 };
        acc[name].value += toNumber(holding.marketValue);
        if (hasKnownCostBasis(holding.costBasis)) {
          acc[name].costBasis += toNumber(holding.costBasis);
          acc[name].knownCostCount += 1;
        }
        return acc;
      },
      {},
    ),
  )
    .map((item) => ({
      ...item,
      value: roundCurrency(item.value),
      costBasis: roundCurrency(item.costBasis),
      roiPercent: item.knownCostCount > 0 ? calculateHoldingROI(item.value, item.costBasis) : null,
      percentOfTotal: totalValue > 0 ? roundPercent((item.value / totalValue) * 100) : 0,
    }))
    .sort((a, b) => b.value - a.value);
}

export function calculateStocksPortfolioSummary(holdings: StockHoldingCalculationInput[]) {
  const totalValue = roundCurrency(holdings.reduce((sum, holding) => sum + toNumber(holding.marketValue), 0));
  const knownCostHoldings = holdings.filter((holding) => hasKnownCostBasis(holding.costBasis));
  const totalCostBasis = roundCurrency(knownCostHoldings.reduce((sum, holding) => sum + toNumber(holding.costBasis), 0));
  const totalGainLoss = totalCostBasis > 0 ? roundCurrency(totalValue - totalCostBasis) : null;
  const totalROI = totalCostBasis > 0 ? calculateHoldingROI(totalValue, totalCostBasis) : null;
  const ranked = holdings
    .filter((holding) => calculateHoldingROI(holding.marketValue, holding.costBasis) !== null)
    .map((holding) => ({
      ...holding,
      roiPercent: calculateHoldingROI(holding.marketValue, holding.costBasis),
    }))
    .sort((a, b) => toNumber(b.roiPercent) - toNumber(a.roiPercent));

  return {
    totalValue,
    totalCostBasis,
    totalGainLoss,
    totalROI,
    costBasisMissingCount: holdings.length - knownCostHoldings.length,
    allocationByBroker: addStockAllocation(holdings, totalValue, "brokerName"),
    allocationBySymbol: addStockAllocation(holdings, totalValue, "symbol"),
    allocationByAccount: addStockAllocation(holdings, totalValue, "accountName"),
    bestPerformer: ranked[0] || null,
    worstPerformer: ranked[ranked.length - 1] || null,
  };
}
