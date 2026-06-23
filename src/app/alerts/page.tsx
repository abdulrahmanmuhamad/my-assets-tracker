import { AlertsWorkspace } from "@/components/alerts/alerts-workspace";
import type { AlertAssetOption } from "@/lib/alerts/client-types";
import { listAlertRules } from "@/lib/alerts/repository";
import { requireApprovedPageUser } from "@/lib/page-auth";
import { METAL_SYMBOL_BY_NAME } from "@/lib/constants";
import { getPortfolioCollections } from "@/lib/data";
import { getMarketIndexes } from "@/lib/market-data/index-prices";
import { isAlertCategoryEnabled } from "@/lib/features";

export const dynamic = "force-dynamic";

export default async function AlertsPage() {
  const user = await requireApprovedPageUser();
  const [rules, collections, indexes] = await Promise.all([
    listAlertRules(user.id),
    getPortfolioCollections(),
    getMarketIndexes(true).catch(() => []),
  ]);
  const options: AlertAssetOption[] = [
    ...collections.minerals.map((item) => ({ key: `mineral:${item.id}`, assetCategory: "mineral" as const, assetId: item.id, symbol: METAL_SYMBOL_BY_NAME[item.mineralType], label: `${item.mineralType} · ${item.purchaseDate}`, baselineValue: item.currentValue, baselineRoi: item.roiPercent })),
    ...collections.prices.map((item) => ({ key: `mineral-price:${item.symbol}`, assetCategory: "mineral" as const, symbol: item.symbol, label: `${item.name} live price`, baselineValue: item.pricePerGram })),
    ...collections.jewelry.map((item) => ({ key: `jewelry:${item.id}`, assetCategory: "jewelry" as const, assetId: item.id, symbol: METAL_SYMBOL_BY_NAME[item.jewelryType], label: item.itemName, baselineValue: item.currentValue, baselineRoi: item.roiPercent })),
    ...collections.realEstate.map((item) => ({ key: `real-estate:${item.id}`, assetCategory: "real_estate" as const, assetId: item.id, label: item.propertyName, baselineValue: item.currentValue, baselineRoi: item.roiPercent })),
    { key: "stock:portfolio", assetCategory: "stock" as const, symbol: "__PORTFOLIO__", label: "Total stocks portfolio", baselineValue: collections.stocks.summary.totalValue, baselineRoi: collections.stocks.summary.totalROI },
    ...collections.stocks.accounts.map((account) => {
      const holdings = collections.stocks.holdings.filter((holding) => holding.brokerageAccountId === account.id);
      const value = holdings.reduce((sum, holding) => sum + holding.marketValue, 0);
      const cost = holdings.reduce((sum, holding) => sum + (holding.costBasis || 0), 0);
      return { key: `stock-account:${account.id}`, assetCategory: "stock" as const, assetId: account.id, symbol: "__ACCOUNT__", label: `${account.brokerName} · ${account.accountName}`, baselineValue: value, baselineRoi: cost > 0 ? ((value - cost) / cost) * 100 : null };
    }),
    ...collections.stocks.holdings.map((item) => ({ key: `stock:${item.id}`, assetCategory: "stock" as const, assetId: item.id, symbol: item.symbol, label: item.symbol || item.securityName, baselineValue: item.currentPrice, baselineRoi: item.unrealizedGainLossPercent })),
    ...indexes.map((item) => ({ key: `index:${item.symbol}`, assetCategory: "market_index" as const, symbol: item.symbol, label: item.name, baselineValue: item.price, baselineRoi: item.changePercent })),
    { key: "bank:portfolio", assetCategory: "bank" as const, label: "All banks", baselineValue: collections.banks.summary.liquidCash },
    ...collections.banks.accounts.map((account) => ({ key: `bank-account:${account.id}`, assetCategory: "bank_account" as const, assetId: account.id, label: `${account.institutionName} / ${account.accountName}`, baselineValue: account.currentBalance })),
    ...collections.banks.transactions.slice(0, 100).map((transaction) => ({ key: `bank-transaction:${transaction.id}`, assetCategory: "bank_transaction" as const, assetId: transaction.id, label: `${transaction.merchantName || transaction.name} / ${transaction.date}`, baselineValue: Math.abs(transaction.amount) })),
  ];
  return <AlertsWorkspace initialRules={rules} assetOptions={options.filter((option) => isAlertCategoryEnabled(option.assetCategory))} />;
}
