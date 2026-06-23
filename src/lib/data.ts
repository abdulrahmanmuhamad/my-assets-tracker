import type {
  AssetFile,
  JewelryItem,
  MineralTransaction,
  PriceCache,
  RealEstateProperty,
  Settings,
} from "@prisma/client";
import { prisma } from "./prisma";
import { getCurrentUser } from "./auth";
import {
  calculateEquity,
  calculateGoldPurity,
  calculateJewelryCurrentValue,
  calculateMineralCurrentValue,
  calculateMonthlyNetCashFlow,
  calculateROI,
  calculateStocksPortfolioSummary,
  convertToGrams,
  sumMonthlyExpenses,
  toNumber,
  type PortfolioAsset,
} from "./calculations";
import type { JewelryInput, MineralInput, RealEstateInput, SettingsInput } from "./validators";
import { METAL_NAME_BY_SYMBOL, METAL_SYMBOL_BY_NAME } from "./constants";
import { removeStoredFile } from "./file-storage";
import { getStocksPortfolio } from "@/services/brokerage/syncService";
import { getAlertDashboardSummary } from "@/lib/alerts/repository";
import { getBanksPortfolio } from "@/lib/banks/bank-sync-service";
import { calculatePortfolioWithOptionalCash } from "@/lib/banks/portfolio";
import { calculateAllBanksSummary } from "@/lib/banks/calculations";
import { isBanksFeatureEnabled, isStocksFeatureEnabled } from "@/lib/features";

export type FileRecord = {
  id: string;
  assetType: string;
  assetId: string;
  fileType: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  metadata: unknown;
  uploadedAt: string;
  url: string;
};

export type MineralRecord = {
  id: string;
  assetType: "mineral";
  name: string;
  mineralType: string;
  purchaseDate: string;
  purchasePrice: number;
  purchaseCurrency: string;
  quantity: number;
  unit: string;
  quantityInGrams: number;
  karat?: number;
  purityPercent?: number;
  effectiveQuantityInGrams: number;
  purchaseLocation: string;
  receiptNumber: string;
  currentPricePerGram: number;
  currentValue: number;
  roiPercent: number;
  notes: string;
  sortOrder: number;
  files: FileRecord[];
};

export type RealEstateRecord = {
  id: string;
  assetType: "real-estate";
  name: string;
  propertyName: string;
  propertyType: string;
  purchaseDate: string;
  purchasePrice: number;
  estimatedCurrentPrice: number;
  address: string;
  isPaidOff: boolean;
  totalPaymentMonths?: number;
  monthsPaid?: number;
  monthsLeft?: number;
  monthlyPayment?: number;
  remainingBalance?: number;
  isRented: boolean;
  monthlyRent?: number;
  rentStartDate: string;
  monthlyExpenses: Record<string, number>;
  monthlyExpenseTotal: number;
  monthlyNetCashFlow: number;
  annualRent: number;
  annualNetCashFlow: number;
  equity: number;
  currentValue: number;
  roiPercent: number;
  notes: string;
  sortOrder: number;
  files: FileRecord[];
};

export type JewelryRecord = {
  id: string;
  assetType: "jewelry";
  name: string;
  jewelryType: string;
  itemName: string;
  purchaseDate: string;
  purchasePrice: number;
  estimatedPriceNow?: number;
  weight: number;
  unit: string;
  weightInGrams: number;
  pricePerGram?: number;
  effectivePricePerGram?: number;
  karat?: number;
  purityPercent?: number;
  gemstoneType: string;
  caratWeight?: number;
  currentValue: number;
  roiPercent: number;
  purchaseLocation: string;
  receiptNumber: string;
  notes: string;
  sortOrder: number;
  files: FileRecord[];
};

export type PortfolioCollections = {
  minerals: MineralRecord[];
  realEstate: RealEstateRecord[];
  jewelry: JewelryRecord[];
  stocks: Awaited<ReturnType<typeof getStocksPortfolio>>;
  banks: Awaited<ReturnType<typeof getBanksPortfolio>>;
  files: FileRecord[];
  prices: PriceRecord[];
  settings: SettingsRecord;
};

export type PriceRecord = {
  id: string;
  symbol: string;
  name: string;
  pricePerGram: number;
  pricePerTroyOunce: number;
  currency: string;
  source: string;
  fetchedAt: string;
};

export type SettingsRecord = {
  id: string;
  defaultCurrency: string;
  preferredMineralUnit: string;
  preferredJewelryWeightUnit: string;
  livePriceProvider: string;
  manualPriceOverrides: Record<string, number>;
  dashboardVisibility: Record<string, boolean>;
  theme: string;
  includeLiquidCashInPortfolio: boolean;
  financialValuesHiddenByDefault: boolean;
};

function dateOnly(value: Date | null | undefined) {
  return value ? value.toISOString().slice(0, 10) : "";
}

function optionalNumber(value: unknown) {
  const parsed = toNumber(value as never);
  return parsed === 0 && (value === null || value === undefined) ? undefined : parsed;
}

function serializeFile(file: AssetFile): FileRecord {
  return {
    id: file.id,
    assetType: file.assetType,
    assetId: file.assetId,
    fileType: file.fileType,
    fileName: file.fileName,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    metadata: file.metadata,
    uploadedAt: file.uploadedAt.toISOString(),
    url: `/api/files/${file.id}`,
  };
}

function groupFiles(files: AssetFile[]) {
  return files.reduce<Record<string, FileRecord[]>>((acc, file) => {
    const key = `${file.assetType}:${file.assetId}`;
    acc[key] ||= [];
    acc[key].push(serializeFile(file));
    return acc;
  }, {});
}

function expensesObject(value: unknown): Record<string, number> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, amount]) => [key, toNumber(amount as never)]),
  );
}

function mineralPurityFactor(row: Pick<MineralTransaction, "mineralType" | "karat" | "purityPercent"> | { mineralType: string; karat?: unknown; purityPercent?: unknown }) {
  if (row.mineralType === "Gold") {
    const karat = toNumber(row.karat as never) || 24;
    return Math.min(Math.max(karat, 1), 24) / 24;
  }

  const purity = toNumber(row.purityPercent as never);
  return purity > 0 ? Math.min(Math.max(purity, 0), 100) / 100 : 1;
}

function jewelryLivePricePerGram(
  row: Pick<JewelryItem, "jewelryType" | "karat" | "purityPercent" | "pricePerGram" | "estimatedPriceNow"> | JewelryInput,
  priceByJewelryType: Record<string, number> = {},
) {
  const type = row.jewelryType;
  const manualPrice = toNumber(row.pricePerGram as never);
  const liveBasePrice = priceByJewelryType[type] || 0;

  if (type === "Gold") {
    const baseGoldPrice = priceByJewelryType.Gold || liveBasePrice || manualPrice;
    return baseGoldPrice;
  }

  if (type === "Silver") {
    return priceByJewelryType.Silver || liveBasePrice || manualPrice;
  }

  return manualPrice;
}

function jewelryEffectivePricePerGram(
  row: Pick<JewelryItem, "jewelryType" | "karat" | "purityPercent" | "pricePerGram" | "estimatedPriceNow"> | JewelryInput,
  priceByJewelryType: Record<string, number> = {},
) {
  const basePrice = jewelryLivePricePerGram(row, priceByJewelryType);

  if (row.jewelryType === "Gold") {
    return basePrice * (calculateGoldPurity(row.karat as never) || 1);
  }

  if (row.jewelryType === "Silver") {
    const purity = toNumber(row.purityPercent as never);
    const factor = purity > 1 ? purity / 100 : purity || 1;
    return basePrice * factor;
  }

  return basePrice;
}

function serializeMineral(
  row: MineralTransaction,
  filesByAsset: Record<string, FileRecord[]> = {},
  priceByMineralType: Record<string, number> = {},
): MineralRecord {
  const livePricePerGram = priceByMineralType[row.mineralType] || toNumber(row.currentPricePerGram);
  const effectiveQuantityInGrams = toNumber(row.quantityInGrams) * mineralPurityFactor(row);
  const currentValue = calculateMineralCurrentValue(effectiveQuantityInGrams, livePricePerGram);
  return {
    id: row.id,
    assetType: "mineral",
    name: `${row.mineralType} purchase`,
    mineralType: row.mineralType,
    purchaseDate: dateOnly(row.purchaseDate),
    purchasePrice: toNumber(row.purchasePrice),
    purchaseCurrency: row.purchaseCurrency,
    quantity: toNumber(row.quantity),
    unit: row.unit,
    quantityInGrams: toNumber(row.quantityInGrams),
    karat: optionalNumber(row.karat),
    purityPercent: optionalNumber(row.purityPercent),
    effectiveQuantityInGrams,
    purchaseLocation: row.purchaseLocation || "",
    receiptNumber: row.receiptNumber || "",
    currentPricePerGram: livePricePerGram,
    currentValue,
    roiPercent: calculateROI(currentValue, row.purchasePrice),
    notes: row.notes || "",
    sortOrder: row.sortOrder,
    files: filesByAsset[`mineral:${row.id}`] || [],
  };
}

function serializeRealEstate(row: RealEstateProperty, filesByAsset: Record<string, FileRecord[]> = {}): RealEstateRecord {
  const expenses = expensesObject(row.monthlyExpenses);
  const monthlyExpenseTotal = sumMonthlyExpenses(expenses);
  const monthlyRent = optionalNumber(row.monthlyRent);
  const monthlyNetCashFlow = toNumber(row.monthlyNetCashFlow);

  return {
    id: row.id,
    assetType: "real-estate",
    name: row.propertyName,
    propertyName: row.propertyName,
    propertyType: row.propertyType,
    purchaseDate: dateOnly(row.purchaseDate),
    purchasePrice: toNumber(row.purchasePrice),
    estimatedCurrentPrice: toNumber(row.estimatedCurrentPrice),
    address: row.address || "",
    isPaidOff: row.isPaidOff,
    totalPaymentMonths: optionalNumber(row.totalPaymentMonths),
    monthsPaid: optionalNumber(row.monthsPaid),
    monthsLeft: optionalNumber(row.monthsLeft),
    monthlyPayment: optionalNumber(row.monthlyPayment),
    remainingBalance: optionalNumber(row.remainingBalance),
    isRented: row.isRented,
    monthlyRent,
    rentStartDate: dateOnly(row.rentStartDate),
    monthlyExpenses: expenses,
    monthlyExpenseTotal,
    monthlyNetCashFlow,
    annualRent: (monthlyRent || 0) * 12,
    annualNetCashFlow: monthlyNetCashFlow * 12,
    equity: toNumber(row.equity),
    currentValue: toNumber(row.estimatedCurrentPrice),
    roiPercent: toNumber(row.roiPercent),
    notes: row.notes || "",
    sortOrder: row.sortOrder,
    files: filesByAsset[`real-estate:${row.id}`] || [],
  };
}

function serializeJewelry(
  row: JewelryItem,
  filesByAsset: Record<string, FileRecord[]> = {},
  priceByJewelryType: Record<string, number> = {},
): JewelryRecord {
  const livePricePerGram = jewelryLivePricePerGram(row, priceByJewelryType);
  const effectivePricePerGram = jewelryEffectivePricePerGram(row, priceByJewelryType);
  const currentValue =
    row.jewelryType === "Gold" || row.jewelryType === "Silver"
      ? calculateJewelryCurrentValue({
          jewelryType: row.jewelryType,
          weightInGrams: row.weightInGrams,
          pricePerGram: livePricePerGram,
          karat: row.karat,
          purityPercent: row.purityPercent,
        })
      : toNumber(row.currentValue);

  return {
    id: row.id,
    assetType: "jewelry",
    name: row.itemName,
    jewelryType: row.jewelryType,
    itemName: row.itemName,
    purchaseDate: dateOnly(row.purchaseDate),
    purchasePrice: toNumber(row.purchasePrice),
    estimatedPriceNow: optionalNumber(row.estimatedPriceNow),
    weight: toNumber(row.weight),
    unit: row.unit,
    weightInGrams: toNumber(row.weightInGrams),
    pricePerGram: livePricePerGram || optionalNumber(row.pricePerGram),
    effectivePricePerGram,
    karat: optionalNumber(row.karat),
    purityPercent: optionalNumber(row.purityPercent),
    gemstoneType: row.gemstoneType || "",
    caratWeight: optionalNumber(row.caratWeight),
    currentValue,
    roiPercent: calculateROI(currentValue, row.purchasePrice),
    purchaseLocation: row.purchaseLocation || "",
    receiptNumber: row.receiptNumber || "",
    notes: row.notes || "",
    sortOrder: row.sortOrder,
    files: filesByAsset[`jewelry:${row.id}`] || [],
  };
}

function serializePrice(row: PriceCache): PriceRecord {
  return {
    id: row.id,
    symbol: row.symbol,
    name: METAL_NAME_BY_SYMBOL[row.symbol] || row.symbol,
    pricePerGram: toNumber(row.pricePerGram),
    pricePerTroyOunce: toNumber(row.pricePerTroyOunce),
    currency: row.currency,
    source: row.source,
    fetchedAt: row.fetchedAt.toISOString(),
  };
}

function serializeSettings(row: Settings): SettingsRecord {
  return {
    id: row.id,
    defaultCurrency: row.defaultCurrency,
    preferredMineralUnit: row.preferredMineralUnit,
    preferredJewelryWeightUnit: row.preferredJewelryWeightUnit,
    livePriceProvider: row.livePriceProvider,
    manualPriceOverrides: expensesObject(row.manualPriceOverrides),
    dashboardVisibility: Object.fromEntries(
      Object.entries((row.dashboardVisibility || {}) as Record<string, unknown>).map(([key, value]) => [
        key,
        Boolean(value),
      ]),
    ),
    theme: row.theme,
    includeLiquidCashInPortfolio: row.includeLiquidCashInPortfolio,
    financialValuesHiddenByDefault: row.financialValuesHiddenByDefault,
  };
}

async function ensureSettings(userId: string) {
  return prisma.settings.upsert({
    where: { userId },
    update: {},
    create: {
      userId,
      manualPriceOverrides: {},
      dashboardVisibility: {
        allocationByCategory: true,
        allocationBySubtype: true,
        realEstateCashFlow: true,
        banksCashSummary: true,
      },
    },
  });
}

export async function getPortfolioCollections(): Promise<PortfolioCollections> {
  const user = await getCurrentUser();
  const [files, minerals, realEstate, jewelry, prices, settings, stocks, banks] = await Promise.all([
    prisma.assetFile.findMany({ where: { userId: user.id }, orderBy: { uploadedAt: "desc" } }),
    prisma.mineralTransaction.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { purchaseDate: "desc" }],
    }),
    prisma.realEstateProperty.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { purchaseDate: "desc" }],
    }),
    prisma.jewelryItem.findMany({
      where: { userId: user.id },
      orderBy: [{ sortOrder: "asc" }, { purchaseDate: "desc" }],
    }),
    prisma.priceCache.findMany({ orderBy: { symbol: "asc" } }),
    ensureSettings(user.id),
    getStocksPortfolio(user.id),
    getBanksPortfolio(user.id),
  ]);
  const filesByAsset = groupFiles(files);
  const priceByMineralType = Object.fromEntries(
    prices.map((price) => [METAL_NAME_BY_SYMBOL[price.symbol] || price.symbol, toNumber(price.pricePerGram)]),
  );
  const priceByJewelryType = {
    Gold: priceByMineralType.Gold || 0,
    Silver: priceByMineralType.Silver || 0,
  };

  return {
    minerals: minerals.map((row) => serializeMineral(row, filesByAsset, priceByMineralType)),
    realEstate: realEstate.map((row) => serializeRealEstate(row, filesByAsset)),
    jewelry: jewelry.map((row) => serializeJewelry(row, filesByAsset, priceByJewelryType)),
    stocks,
    banks,
    files: files.map(serializeFile),
    prices: prices.map(serializePrice),
    settings: serializeSettings(settings),
  };
}

export function flattenPortfolioAssets(collections: Pick<PortfolioCollections, "minerals" | "realEstate" | "jewelry" | "stocks">): PortfolioAsset[] {
  return [
    ...collections.minerals.map((asset) => ({
      id: asset.id,
      name: asset.name,
      category: "Minerals",
      subType: asset.mineralType,
      purchaseDate: asset.purchaseDate,
      purchasePrice: asset.purchasePrice,
      currentValue: asset.currentValue,
      roiPercent: asset.roiPercent,
    })),
    ...collections.realEstate.map((asset) => ({
      id: asset.id,
      name: asset.propertyName,
      category: "Real Estate",
      subType: asset.propertyType,
      purchaseDate: asset.purchaseDate,
      purchasePrice: asset.purchasePrice,
      currentValue: asset.currentValue,
      roiPercent: asset.roiPercent,
    })),
    ...collections.jewelry.map((asset) => ({
      id: asset.id,
      name: asset.itemName,
      category: "Jewelry",
      subType: asset.jewelryType,
      purchaseDate: asset.purchaseDate,
      purchasePrice: asset.purchasePrice,
      currentValue: asset.currentValue,
      roiPercent: asset.roiPercent,
    })),
    ...(isStocksFeatureEnabled() ? collections.stocks.holdings : []).map((holding) => ({
      id: holding.id,
      name: holding.symbol || holding.securityName,
      category: "Stocks",
      subType: holding.brokerName || "Brokerage",
      purchaseDate: holding.asOfDate,
      purchasePrice: holding.costBasis ?? 0,
      currentValue: holding.marketValue,
      roiPercent: holding.unrealizedGainLossPercent ?? 0,
    })),
  ];
}

export async function getDashboardSummary() {
  const user = await getCurrentUser();
  const [collections, alerts] = await Promise.all([getPortfolioCollections(), getAlertDashboardSummary(user.id)]);
  const assets = flattenPortfolioAssets(collections);
  const stocksEnabled = isStocksFeatureEnabled();
  const banksEnabled = isBanksFeatureEnabled();
  const liquidCash = banksEnabled ? collections.banks.summary.liquidCash : 0;
  const portfolioCash = calculatePortfolioWithOptionalCash(
    assets,
    liquidCash,
    banksEnabled && collections.settings.includeLiquidCashInPortfolio,
  );
  const summary = portfolioCash.selected;
  const realEstate = collections.realEstate;

  return {
    ...summary,
    counts: {
      minerals: collections.minerals.length,
      realEstate: collections.realEstate.length,
      jewelry: collections.jewelry.length,
      stocks: stocksEnabled ? collections.stocks.holdings.length : 0,
      bankAccounts: banksEnabled ? collections.banks.accounts.length : 0,
      files: collections.files.length,
    },
    realEstate: {
      residentialValue: realEstate
        .filter((item) => item.propertyType === "Residential")
        .reduce((sum, item) => sum + item.currentValue, 0),
      commercialValue: realEstate
        .filter((item) => item.propertyType === "Commercial")
        .reduce((sum, item) => sum + item.currentValue, 0),
      paidOffCount: realEstate.filter((item) => item.isPaidOff).length,
      financedCount: realEstate.filter((item) => !item.isPaidOff).length,
      rentedCount: realEstate.filter((item) => item.isRented).length,
      vacantCount: realEstate.filter((item) => !item.isRented).length,
      monthlyNetCashFlow: realEstate.reduce((sum, item) => sum + item.monthlyNetCashFlow, 0),
    },
    assets,
    stocks: stocksEnabled ? collections.stocks : {
      connections: [],
      accounts: [],
      holdings: [],
      transactions: [],
      summary: calculateStocksPortfolioSummary([]),
    },
    banks: banksEnabled ? collections.banks : {
      connections: [],
      accounts: [],
      transactions: [],
      summary: { ...calculateAllBanksSummary([]), connectedBanks: 0, lastSyncedAt: null },
    },
    liquidCash,
    creditCardDebt: banksEnabled ? collections.banks.summary.creditCardDebt : 0,
    netCashAfterDebt: banksEnabled ? collections.banks.summary.netCashAfterDebt : 0,
    includeLiquidCashInPortfolio: banksEnabled && collections.settings.includeLiquidCashInPortfolio,
    portfolioValueWithCash: portfolioCash.withCash.totalPortfolioValue,
    portfolioValueWithoutCash: portfolioCash.withoutCash.totalPortfolioValue,
    settings: collections.settings,
    alerts,
  };
}

async function nextSortOrder(userId: string, model: "mineral" | "real-estate" | "jewelry") {
  if (model === "mineral") {
    const result = await prisma.mineralTransaction.aggregate({ where: { userId }, _max: { sortOrder: true } });
    return (result._max.sortOrder || 0) + 1;
  }

  if (model === "real-estate") {
    const result = await prisma.realEstateProperty.aggregate({ where: { userId }, _max: { sortOrder: true } });
    return (result._max.sortOrder || 0) + 1;
  }

  const result = await prisma.jewelryItem.aggregate({ where: { userId }, _max: { sortOrder: true } });
  return (result._max.sortOrder || 0) + 1;
}

export async function listMinerals() {
  return (await getPortfolioCollections()).minerals;
}

export async function createMineral(input: MineralInput) {
  const user = await getCurrentUser();
  const quantityInGrams = convertToGrams(input.quantity, input.unit);
  const currentPricePerGram = (await getMetalPricePerGram(input.mineralType)) || input.currentPricePerGram || 0;
  const purityFactor = mineralPurityFactor(input);
  const currentValue = calculateMineralCurrentValue(quantityInGrams * purityFactor, currentPricePerGram);
  const created = await prisma.mineralTransaction.create({
    data: {
      ...input,
      userId: user.id,
      karat: input.mineralType === "Gold" ? input.karat ?? 24 : null,
      purityPercent: input.mineralType === "Gold" ? null : input.purityPercent ?? 100,
      purchaseLocation: input.purchaseLocation || null,
      receiptNumber: input.receiptNumber || null,
      notes: input.notes || null,
      quantityInGrams,
      currentPricePerGram,
      currentValue,
      roiPercent: calculateROI(currentValue, input.purchasePrice),
      sortOrder: input.sortOrder ?? (await nextSortOrder(user.id, "mineral")),
    },
  });
  return serializeMineral(created, {}, { [input.mineralType]: currentPricePerGram });
}

export async function updateMineral(id: string, input: MineralInput) {
  const user = await getCurrentUser();
  const existing = await prisma.mineralTransaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) throw new Error("Mineral transaction not found");

  const quantityInGrams = convertToGrams(input.quantity, input.unit);
  const currentPricePerGram = (await getMetalPricePerGram(input.mineralType)) || input.currentPricePerGram || 0;
  const purityFactor = mineralPurityFactor(input);
  const currentValue = calculateMineralCurrentValue(quantityInGrams * purityFactor, currentPricePerGram);
  const updated = await prisma.mineralTransaction.update({
    where: { id },
    data: {
      ...input,
      karat: input.mineralType === "Gold" ? input.karat ?? 24 : null,
      purityPercent: input.mineralType === "Gold" ? null : input.purityPercent ?? 100,
      purchaseLocation: input.purchaseLocation || null,
      receiptNumber: input.receiptNumber || null,
      notes: input.notes || null,
      quantityInGrams,
      currentPricePerGram,
      currentValue,
      roiPercent: calculateROI(currentValue, input.purchasePrice),
    },
  });
  return serializeMineral(updated, {}, { [input.mineralType]: currentPricePerGram });
}

export async function deleteMineral(id: string) {
  const user = await getCurrentUser();
  const existing = await prisma.mineralTransaction.findFirst({ where: { id, userId: user.id } });
  if (!existing) throw new Error("Mineral transaction not found");
  await deleteAssetFiles("mineral", id, user.id);
  await prisma.mineralTransaction.delete({ where: { id } });
}

export async function listRealEstate() {
  return (await getPortfolioCollections()).realEstate;
}

export async function createRealEstate(input: RealEstateInput) {
  const user = await getCurrentUser();
  const monthlyNetCashFlow = calculateMonthlyNetCashFlow(input);
  const equity = calculateEquity(input);
  const created = await prisma.realEstateProperty.create({
    data: {
      ...input,
      userId: user.id,
      address: input.address || null,
      rentStartDate: input.rentStartDate || null,
      notes: input.notes || null,
      monthlyNetCashFlow,
      equity,
      roiPercent: calculateROI(input.estimatedCurrentPrice, input.purchasePrice),
      sortOrder: input.sortOrder ?? (await nextSortOrder(user.id, "real-estate")),
    },
  });
  return serializeRealEstate(created);
}

export async function updateRealEstate(id: string, input: RealEstateInput) {
  const user = await getCurrentUser();
  const existing = await prisma.realEstateProperty.findFirst({ where: { id, userId: user.id } });
  if (!existing) throw new Error("Property not found");
  const monthlyNetCashFlow = calculateMonthlyNetCashFlow(input);
  const equity = calculateEquity(input);
  const updated = await prisma.realEstateProperty.update({
    where: { id },
    data: {
      ...input,
      address: input.address || null,
      rentStartDate: input.rentStartDate || null,
      notes: input.notes || null,
      monthlyNetCashFlow,
      equity,
      roiPercent: calculateROI(input.estimatedCurrentPrice, input.purchasePrice),
    },
  });
  return serializeRealEstate(updated);
}

export async function deleteRealEstate(id: string) {
  const user = await getCurrentUser();
  const existing = await prisma.realEstateProperty.findFirst({ where: { id, userId: user.id } });
  if (!existing) throw new Error("Property not found");
  await deleteAssetFiles("real-estate", id, user.id);
  await prisma.realEstateProperty.delete({ where: { id } });
}

export async function listJewelry() {
  return (await getPortfolioCollections()).jewelry;
}

export async function createJewelry(input: JewelryInput) {
  const user = await getCurrentUser();
  const weightInGrams = convertToGrams(input.weight, input.unit);
  const priceByJewelryType = {
    Gold: await getMetalPricePerGram("Gold"),
    Silver: await getMetalPricePerGram("Silver"),
  };
  const livePricePerGram = jewelryLivePricePerGram(input, priceByJewelryType);
  const currentValue = calculateJewelryCurrentValue({
    ...input,
    weightInGrams,
    pricePerGram: livePricePerGram || input.pricePerGram,
    estimatedPriceNow: input.jewelryType === "Gold" || input.jewelryType === "Silver" ? undefined : input.estimatedPriceNow,
  });
  const created = await prisma.jewelryItem.create({
    data: {
      ...input,
      userId: user.id,
      estimatedPriceNow: input.jewelryType === "Gold" || input.jewelryType === "Silver" ? null : input.estimatedPriceNow || null,
      pricePerGram: livePricePerGram || input.pricePerGram || null,
      karat: input.jewelryType === "Gold" ? input.karat || 24 : null,
      purityPercent: input.jewelryType === "Silver" || input.jewelryType === "Gold Plated" ? input.purityPercent || 100 : null,
      gemstoneType: input.gemstoneType || null,
      caratWeight: input.caratWeight || null,
      purchaseLocation: input.purchaseLocation || null,
      receiptNumber: input.receiptNumber || null,
      notes: input.notes || null,
      weightInGrams,
      currentValue,
      roiPercent: calculateROI(currentValue, input.purchasePrice),
      sortOrder: input.sortOrder ?? (await nextSortOrder(user.id, "jewelry")),
    },
  });
  return serializeJewelry(created, {}, priceByJewelryType);
}

export async function updateJewelry(id: string, input: JewelryInput) {
  const user = await getCurrentUser();
  const existing = await prisma.jewelryItem.findFirst({ where: { id, userId: user.id } });
  if (!existing) throw new Error("Jewelry item not found");
  const weightInGrams = convertToGrams(input.weight, input.unit);
  const priceByJewelryType = {
    Gold: await getMetalPricePerGram("Gold"),
    Silver: await getMetalPricePerGram("Silver"),
  };
  const livePricePerGram = jewelryLivePricePerGram(input, priceByJewelryType);
  const currentValue = calculateJewelryCurrentValue({
    ...input,
    weightInGrams,
    pricePerGram: livePricePerGram || input.pricePerGram,
    estimatedPriceNow: input.jewelryType === "Gold" || input.jewelryType === "Silver" ? undefined : input.estimatedPriceNow,
  });
  const updated = await prisma.jewelryItem.update({
    where: { id },
    data: {
      ...input,
      estimatedPriceNow: input.jewelryType === "Gold" || input.jewelryType === "Silver" ? null : input.estimatedPriceNow || null,
      pricePerGram: livePricePerGram || input.pricePerGram || null,
      karat: input.jewelryType === "Gold" ? input.karat || 24 : null,
      purityPercent: input.jewelryType === "Silver" || input.jewelryType === "Gold Plated" ? input.purityPercent || 100 : null,
      gemstoneType: input.gemstoneType || null,
      caratWeight: input.caratWeight || null,
      purchaseLocation: input.purchaseLocation || null,
      receiptNumber: input.receiptNumber || null,
      notes: input.notes || null,
      weightInGrams,
      currentValue,
      roiPercent: calculateROI(currentValue, input.purchasePrice),
    },
  });
  return serializeJewelry(updated, {}, priceByJewelryType);
}

export async function deleteJewelry(id: string) {
  const user = await getCurrentUser();
  const existing = await prisma.jewelryItem.findFirst({ where: { id, userId: user.id } });
  if (!existing) throw new Error("Jewelry item not found");
  await deleteAssetFiles("jewelry", id, user.id);
  await prisma.jewelryItem.delete({ where: { id } });
}

export async function reorderAssets(model: "mineral" | "real-estate" | "jewelry", orderedIds: string[]) {
  const user = await getCurrentUser();
  await prisma.$transaction(
    orderedIds.map((id, index) => {
      if (model === "mineral") {
        return prisma.mineralTransaction.updateMany({
          where: { id, userId: user.id },
          data: { sortOrder: index + 1 },
        });
      }

      if (model === "real-estate") {
        return prisma.realEstateProperty.updateMany({
          where: { id, userId: user.id },
          data: { sortOrder: index + 1 },
        });
      }

      return prisma.jewelryItem.updateMany({
        where: { id, userId: user.id },
        data: { sortOrder: index + 1 },
      });
    }),
  );
}

export async function createAssetFile(data: {
  assetType: string;
  assetId: string;
  fileType: string;
  fileUrl: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const user = await getCurrentUser();
  await assertAssetBelongsToUser(data.assetType, data.assetId, user.id);
  const file = await prisma.assetFile.create({
    data: {
      ...data,
      userId: user.id,
    },
  });
  return serializeFile(file);
}

export async function getAssetFile(id: string) {
  const user = await getCurrentUser();
  return prisma.assetFile.findFirst({ where: { id, userId: user.id } });
}

export async function deleteAssetFile(id: string) {
  const user = await getCurrentUser();
  const file = await prisma.assetFile.findFirst({ where: { id, userId: user.id } });
  if (!file) throw new Error("File not found");
  await removeStoredFile(file);
  await prisma.assetFile.delete({ where: { id } });
}

async function deleteAssetFiles(assetType: string, assetId: string, userId: string) {
  const files = await prisma.assetFile.findMany({ where: { userId, assetType, assetId } });
  await Promise.all(files.map((file) => removeStoredFile(file)));
  await prisma.assetFile.deleteMany({ where: { userId, assetType, assetId } });
}

async function assertAssetBelongsToUser(assetType: string, assetId: string, userId: string) {
  if (assetType === "mineral") {
    const found = await prisma.mineralTransaction.count({ where: { id: assetId, userId } });
    if (!found) throw new Error("Asset not found");
    return;
  }

  if (assetType === "real-estate") {
    const found = await prisma.realEstateProperty.count({ where: { id: assetId, userId } });
    if (!found) throw new Error("Asset not found");
    return;
  }

  if (assetType === "jewelry") {
    const found = await prisma.jewelryItem.count({ where: { id: assetId, userId } });
    if (!found) throw new Error("Asset not found");
    return;
  }

  throw new Error("Unsupported asset type");
}

export async function getSettings() {
  const user = await getCurrentUser();
  return serializeSettings(await ensureSettings(user.id));
}

export async function updateSettings(input: SettingsInput) {
  const user = await getCurrentUser();
  const settings = await prisma.settings.upsert({
    where: { userId: user.id },
    update: input,
    create: {
      ...input,
      userId: user.id,
    },
  });
  return serializeSettings(settings);
}

export async function getMetalPricePerGram(name: string) {
  const symbol = METAL_SYMBOL_BY_NAME[name];
  if (!symbol) return 0;
  const price = await prisma.priceCache.findUnique({ where: { symbol } });
  return price ? toNumber(price.pricePerGram) : 0;
}
