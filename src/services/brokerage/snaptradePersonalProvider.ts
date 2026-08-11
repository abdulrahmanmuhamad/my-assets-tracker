import "server-only";
import {
  Snaptrade,
  SnaptradeAuth,
  type Account,
  type AccountPosition,
  type AccountUniversalActivity,
  type Balance,
  type BrokerageAuthorization,
} from "snaptrade-typescript-sdk";
import {
  calculateHoldingGainLoss,
  calculateHoldingMarketValue,
  calculateHoldingROI,
  roundCurrency,
} from "@/lib/calculations";
import type { BrokerageSyncResult, NormalizedStockHolding, NormalizedStockTransaction } from "./types";

export type SnapTradePersonalCredential = { clientId: string; consumerKey: string };

export class ProviderReauthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProviderReauthenticationError";
  }
}

export function serializeSnapTradeCredential(credential: SnapTradePersonalCredential) {
  return JSON.stringify(credential);
}

export function parseSnapTradeCredential(value: string): SnapTradePersonalCredential {
  let parsed: unknown;
  try {
    parsed = JSON.parse(value);
  } catch {
    throw new Error("Stored SnapTrade credential is invalid");
  }
  if (!parsed || typeof parsed !== "object") throw new Error("Stored SnapTrade credential is invalid");
  const clientId = String((parsed as Record<string, unknown>).clientId || "").trim();
  const consumerKey = String((parsed as Record<string, unknown>).consumerKey || "").trim();
  if (!clientId || !consumerKey) throw new Error("Stored SnapTrade credential is incomplete");
  return { clientId, consumerKey };
}

function client(credential: SnapTradePersonalCredential) {
  return new Snaptrade({ auth: SnaptradeAuth.personalApiKey(credential) });
}

function numberOrNull(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function lastFour(value: string | null | undefined) {
  const digits = String(value || "").replace(/\D/g, "");
  return digits ? digits.slice(-4) : null;
}

function brokerageName(authorization: BrokerageAuthorization | undefined) {
  return authorization?.brokerage?.display_name || authorization?.brokerage?.name || authorization?.name || "Connected brokerage";
}

export function normalizeSnapTradeAuthorization(authorization: BrokerageAuthorization) {
  const id = String(authorization.id || "");
  return {
    id,
    institutionName: brokerageName(authorization),
    institutionLogoUrl: authorization.brokerage?.aws_s3_square_logo_url || authorization.brokerage?.aws_s3_logo_url || null,
    status: authorization.disabled ? "requires_reauth" : "active",
  };
}

export async function createSnapTradePortal(
  credential: SnapTradePersonalCredential,
  redirectUrl: string,
  reconnect?: string,
) {
  const response = await client(credential).authentication.loginSnapTradeUser({
    connectionType: "read",
    customRedirect: redirectUrl,
    immediateRedirect: true,
    showCloseButton: true,
    ...(reconnect ? { reconnect } : {}),
  });
  if (!("redirectURI" in response.data) || !response.data.redirectURI) {
    throw new Error("SnapTrade did not return a connection URL");
  }
  return { redirectUri: response.data.redirectURI };
}

export async function listSnapTradeAuthorizations(credential: SnapTradePersonalCredential) {
  const response = await client(credential).connections.listBrokerageAuthorizations();
  return response.data.map(normalizeSnapTradeAuthorization).filter((authorization) => authorization.id);
}

function normalizePosition(accountId: string, position: AccountPosition, asOf: Date): NormalizedStockHolding {
  const instrument = position.instrument;
  const quantity = numberOrNull(position.units) || 0;
  const currentPrice = numberOrNull(position.price);
  const averageCost = numberOrNull(position.cost_basis);
  const marketValue = calculateHoldingMarketValue(quantity, currentPrice || 0);
  const costBasis = averageCost === null ? null : roundCurrency(Math.abs(quantity) * averageCost);
  const gainLoss = costBasis && costBasis > 0 ? calculateHoldingGainLoss(marketValue, costBasis) : null;
  return {
    providerHoldingId: `${accountId}:${instrument.id}`,
    providerAccountId: accountId,
    symbol: instrument.symbol || instrument.raw_symbol || null,
    securityName: instrument.description || instrument.symbol || "Unknown security",
    securityType: instrument.kind,
    cusip: null,
    isin: null,
    quantity,
    costBasis,
    averageCost,
    currentPrice,
    marketValue,
    unrealizedGainLoss: gainLoss,
    unrealizedGainLossPercent: costBasis && costBasis > 0 ? calculateHoldingROI(marketValue, costBasis) : null,
    currency: position.currency || instrument.currency || "USD",
    asOfDate: asOf,
  };
}

function normalizeActivity(accountId: string, activity: AccountUniversalActivity): NormalizedStockTransaction | null {
  if (!activity.id || !activity.trade_date) return null;
  const symbol = activity.symbol?.symbol || activity.option_symbol?.ticker || null;
  return {
    providerTransactionId: String(activity.id),
    providerAccountId: accountId,
    symbol,
    securityName: activity.symbol?.description || activity.option_symbol?.ticker || activity.description || null,
    transactionType: String(activity.type || "other").toLowerCase(),
    quantity: numberOrNull(activity.units),
    price: numberOrNull(activity.price),
    amount: numberOrNull(activity.amount) || 0,
    fees: numberOrNull(activity.fee),
    date: new Date(activity.trade_date),
    currency: activity.currency?.code || "USD",
  };
}

function accountCurrency(account: Account) {
  return account.balance?.total?.currency || "USD";
}

function accountRecord(account: Account, balances: Balance[]) {
  const currency = accountCurrency(account);
  const preferredBalance = balances.find((balance) => balance.currency?.code === currency) || balances[0];
  return {
    providerAccountId: account.id,
    brokerName: account.institution_name,
    accountName: account.name || "Investment account",
    accountType: "brokerage",
    accountSubtype: account.raw_type || account.account_category?.toLowerCase() || null,
    mask: lastFour(account.number),
    currency,
    currentBalance: numberOrNull(account.balance?.total?.amount),
    availableBalance: numberOrNull(preferredBalance?.cash),
    officialName: account.name,
  };
}

export async function syncSnapTradeAuthorization(
  credential: SnapTradePersonalCredential,
  authorizationId: string,
): Promise<BrokerageSyncResult> {
  const snaptrade = client(credential);
  const authorizations = await snaptrade.connections.listBrokerageAuthorizations();
  const authorization = authorizations.data.find((item) => item.id === authorizationId);
  if (!authorization) throw new Error("SnapTrade brokerage connection no longer exists");
  if (authorization.disabled) throw new ProviderReauthenticationError("SnapTrade brokerage authorization must be reconnected");
  const accountsResponse = await snaptrade.connections.listBrokerageAuthorizationAccounts({ authorizationId });
  const accounts = accountsResponse.data.filter((account) => account.account_category !== "DEPOSIT");
  const holdings: NormalizedStockHolding[] = [];
  const transactions: NormalizedStockTransaction[] = [];
  const normalizedAccounts = [];

  for (const account of accounts) {
    const end = new Date();
    const start = new Date(end);
    start.setFullYear(start.getFullYear() - 1);
    const [balancesResponse, positionsResponse, activitiesResponse] = await Promise.all([
      snaptrade.accountInformation.getUserAccountBalance({ accountId: account.id }),
      snaptrade.accountInformation.getAllAccountPositions({ accountId: account.id }),
      snaptrade.accountInformation.getAccountActivities({
        accountId: account.id,
        startDate: start,
        endDate: end,
        limit: 500,
      }).catch(() => null),
    ]);
    normalizedAccounts.push(accountRecord(account, balancesResponse.data));
    const reportedAsOf = new Date(positionsResponse.data.data_freshness.as_of);
    const asOf = Number.isNaN(reportedAsOf.getTime()) ? new Date() : reportedAsOf;
    holdings.push(...positionsResponse.data.results.map((position) => normalizePosition(account.id, position, asOf)));
    transactions.push(...(activitiesResponse?.data.data || []).map((activity) => normalizeActivity(account.id, activity)).filter((activity): activity is NormalizedStockTransaction => Boolean(activity)));
  }

  return {
    providerItemId: authorizationId,
    institutionId: authorizationId,
    institutionName: brokerageName(authorization),
    institutionLogoUrl: authorization.brokerage?.aws_s3_square_logo_url || authorization.brokerage?.aws_s3_logo_url || null,
    accounts: normalizedAccounts,
    holdings,
    transactions,
  };
}

export async function deleteSnapTradeAuthorization(credential: SnapTradePersonalCredential, authorizationId: string) {
  await client(credential).connections.deleteConnection({ connectionId: authorizationId });
}
