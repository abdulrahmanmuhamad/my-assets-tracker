import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { deleteProviderCredential, getProviderCredential, saveProviderCredential } from "@/lib/provider-credentials";
import { calculateStocksPortfolioSummary, toNumber } from "@/lib/calculations";
import { plaidProvider } from "./plaidProvider";
import type { BrokerageProvider, BrokerageSyncResult, NormalizedStockHolding } from "./types";
import { assertBrokerageConnectionOwnership, brokerageOwnershipWhere, safeBrokerageConnection } from "./security";
import {
  createSnapTradePortal,
  deleteSnapTradeAuthorization,
  listSnapTradeAuthorizations,
  parseSnapTradeCredential,
  ProviderReauthenticationError,
  serializeSnapTradeCredential,
  syncSnapTradeAuthorization,
} from "./snaptradePersonalProvider";

const providers: Record<string, BrokerageProvider> = {
  plaid: plaidProvider,
};

function providerFor(name: string) {
  const provider = providers[name];
  if (!provider) throw new Error(`Unsupported brokerage provider: ${name}`);
  return provider;
}

function serializeAccount(account: {
  id: string;
  brokerageConnectionId: string;
  providerAccountId: string;
  brokerName: string;
  accountName: string;
  accountType: string;
  accountSubtype: string | null;
  mask: string | null;
  currency: string;
  currentBalance: unknown;
  availableBalance: unknown;
  officialName: string | null;
}) {
  return {
    ...account,
    currentBalance: account.currentBalance === null || account.currentBalance === undefined ? null : toNumber(account.currentBalance as never),
    availableBalance: account.availableBalance === null || account.availableBalance === undefined ? null : toNumber(account.availableBalance as never),
  };
}

function serializeHolding(holding: {
  id: string;
  brokerageAccountId: string;
  brokerageConnectionId: string;
  providerHoldingId: string;
  symbol: string | null;
  securityName: string;
  securityType: string;
  cusip: string | null;
  isin: string | null;
  quantity: unknown;
  costBasis: unknown;
  averageCost: unknown;
  currentPrice: unknown;
  marketValue: unknown;
  unrealizedGainLoss: unknown;
  unrealizedGainLossPercent: unknown;
  currency: string;
  asOfDate: Date;
  brokerageAccount?: { accountName: string; brokerName: string } | null;
}) {
  return {
    ...holding,
    accountName: holding.brokerageAccount?.accountName || "",
    brokerName: holding.brokerageAccount?.brokerName || "",
    quantity: toNumber(holding.quantity as never),
    costBasis: holding.costBasis === null || holding.costBasis === undefined ? null : toNumber(holding.costBasis as never),
    averageCost: holding.averageCost === null || holding.averageCost === undefined ? null : toNumber(holding.averageCost as never),
    currentPrice: holding.currentPrice === null || holding.currentPrice === undefined ? null : toNumber(holding.currentPrice as never),
    marketValue: toNumber(holding.marketValue as never),
    unrealizedGainLoss: holding.unrealizedGainLoss === null || holding.unrealizedGainLoss === undefined ? null : toNumber(holding.unrealizedGainLoss as never),
    unrealizedGainLossPercent:
      holding.unrealizedGainLossPercent === null || holding.unrealizedGainLossPercent === undefined
        ? null
        : toNumber(holding.unrealizedGainLossPercent as never),
    asOfDate: holding.asOfDate.toISOString(),
  };
}

function serializeTransaction(transaction: {
  id: string;
  brokerageAccountId: string;
  brokerageConnectionId: string;
  providerTransactionId: string;
  symbol: string | null;
  securityName: string | null;
  transactionType: string;
  quantity: unknown;
  price: unknown;
  amount: unknown;
  fees: unknown;
  date: Date;
  currency: string;
  brokerageAccount?: { accountName: string; brokerName: string } | null;
}) {
  return {
    ...transaction,
    accountName: transaction.brokerageAccount?.accountName || "",
    brokerName: transaction.brokerageAccount?.brokerName || "",
    quantity: transaction.quantity === null || transaction.quantity === undefined ? null : toNumber(transaction.quantity as never),
    price: transaction.price === null || transaction.price === undefined ? null : toNumber(transaction.price as never),
    amount: toNumber(transaction.amount as never),
    fees: transaction.fees === null || transaction.fees === undefined ? null : toNumber(transaction.fees as never),
    date: transaction.date.toISOString().slice(0, 10),
  };
}

async function writeSyncData(userId: string, connectionId: string, sync: BrokerageSyncResult) {
  const accountIdByProviderId = new Map<string, string>();
  const activeProviderAccountIds: string[] = [];

  for (const account of sync.accounts) {
    activeProviderAccountIds.push(account.providerAccountId);
    const saved = await prisma.brokerageAccount.upsert({
      where: {
        brokerageConnectionId_providerAccountId: {
          brokerageConnectionId: connectionId,
          providerAccountId: account.providerAccountId,
        },
      },
      update: {
        brokerName: account.brokerName,
        accountName: account.accountName,
        accountType: account.accountType,
        accountSubtype: account.accountSubtype,
        mask: account.mask,
        currency: account.currency,
        currentBalance: account.currentBalance,
        availableBalance: account.availableBalance,
        officialName: account.officialName,
      },
      create: {
        userId,
        brokerageConnectionId: connectionId,
        providerAccountId: account.providerAccountId,
        brokerName: account.brokerName,
        accountName: account.accountName,
        accountType: account.accountType,
        accountSubtype: account.accountSubtype,
        mask: account.mask,
        currency: account.currency,
        currentBalance: account.currentBalance,
        availableBalance: account.availableBalance,
        officialName: account.officialName,
      },
    });
    accountIdByProviderId.set(account.providerAccountId, saved.id);
  }

  await prisma.brokerageAccount.deleteMany({
    where: {
      userId,
      brokerageConnectionId: connectionId,
      ...(activeProviderAccountIds.length ? { providerAccountId: { notIn: activeProviderAccountIds } } : {}),
    },
  });

  const activeHoldingIds: string[] = [];
  for (const holding of sync.holdings) {
    const brokerageAccountId = accountIdByProviderId.get(holding.providerAccountId);
    if (!brokerageAccountId) continue;
    activeHoldingIds.push(holding.providerHoldingId);
    await prisma.stockHolding.upsert({
      where: {
        brokerageAccountId_providerHoldingId: {
          brokerageAccountId,
          providerHoldingId: holding.providerHoldingId,
        },
      },
      update: {
        symbol: holding.symbol,
        securityName: holding.securityName,
        securityType: holding.securityType,
        cusip: holding.cusip,
        isin: holding.isin,
        quantity: holding.quantity,
        costBasis: holding.costBasis,
        averageCost: holding.averageCost,
        currentPrice: holding.currentPrice,
        marketValue: holding.marketValue,
        unrealizedGainLoss: holding.unrealizedGainLoss,
        unrealizedGainLossPercent: holding.unrealizedGainLossPercent,
        currency: holding.currency,
        asOfDate: holding.asOfDate,
      },
      create: {
        userId,
        brokerageAccountId,
        brokerageConnectionId: connectionId,
        providerHoldingId: holding.providerHoldingId,
        symbol: holding.symbol,
        securityName: holding.securityName,
        securityType: holding.securityType,
        cusip: holding.cusip,
        isin: holding.isin,
        quantity: holding.quantity,
        costBasis: holding.costBasis,
        averageCost: holding.averageCost,
        currentPrice: holding.currentPrice,
        marketValue: holding.marketValue,
        unrealizedGainLoss: holding.unrealizedGainLoss,
        unrealizedGainLossPercent: holding.unrealizedGainLossPercent,
        currency: holding.currency,
        asOfDate: holding.asOfDate,
      },
    });
  }

  await prisma.stockHolding.deleteMany({
    where: {
      userId,
      brokerageConnectionId: connectionId,
      ...(activeHoldingIds.length ? { providerHoldingId: { notIn: activeHoldingIds } } : {}),
    },
  });

  for (const transaction of sync.transactions) {
    const brokerageAccountId = accountIdByProviderId.get(transaction.providerAccountId);
    if (!brokerageAccountId) continue;
    await prisma.stockTransaction.upsert({
      where: {
        brokerageConnectionId_providerTransactionId: {
          brokerageConnectionId: connectionId,
          providerTransactionId: transaction.providerTransactionId,
        },
      },
      update: {
        symbol: transaction.symbol,
        securityName: transaction.securityName,
        transactionType: transaction.transactionType,
        quantity: transaction.quantity,
        price: transaction.price,
        amount: transaction.amount,
        fees: transaction.fees,
        date: transaction.date,
        currency: transaction.currency,
      },
      create: {
        userId,
        brokerageAccountId,
        brokerageConnectionId: connectionId,
        providerTransactionId: transaction.providerTransactionId,
        symbol: transaction.symbol,
        securityName: transaction.securityName,
        transactionType: transaction.transactionType,
        quantity: transaction.quantity,
        price: transaction.price,
        amount: transaction.amount,
        fees: transaction.fees,
        date: transaction.date,
        currency: transaction.currency,
      },
    });
  }
}

export async function createBrokerageLinkToken(userId: string, providerName = "plaid") {
  return providerFor(providerName).createLinkToken(userId);
}

export async function exchangePlaidPublicToken(userId: string, publicToken: string) {
  const provider = providerFor("plaid");
  const result = await provider.exchangePublicToken(userId, publicToken);
  const encryptedToken = encryptSecret(result.accessToken);
  const existing = await prisma.brokerageConnection.findUnique({
    where: { provider_providerItemId: { provider: "plaid", providerItemId: result.providerItemId } },
    select: { userId: true },
  });
  assertBrokerageConnectionOwnership(existing?.userId, userId);
  const connection = await prisma.brokerageConnection.upsert({
    where: {
      provider_providerItemId: {
        provider: "plaid",
        providerItemId: result.providerItemId,
      },
    },
    update: {
      userId,
      providerAccessTokenEncrypted: encryptedToken,
      institutionId: result.institutionId,
      institutionName: result.institutionName || "Connected brokerage",
      institutionLogoUrl: result.institutionLogoUrl,
      status: "active",
      lastSyncedAt: new Date(),
    },
    create: {
      userId,
      provider: "plaid",
      providerItemId: result.providerItemId,
      providerAccessTokenEncrypted: encryptedToken,
      institutionId: result.institutionId,
      institutionName: result.institutionName || "Connected brokerage",
      institutionLogoUrl: result.institutionLogoUrl,
      status: "active",
      lastSyncedAt: new Date(),
    },
  });

  await writeSyncData(userId, connection.id, result.sync);
  await prisma.brokerageSyncLog.create({
    data: {
      userId,
      brokerageConnectionId: connection.id,
      provider: "plaid",
      status: "success",
      message: "Initial Plaid sync completed",
      finishedAt: new Date(),
    },
  });

  return safeBrokerageConnection(connection);
}

function scopedProviderItemId(userId: string, providerItemId: string) {
  return `${userId}:${providerItemId}`;
}

function unscopedProviderItemId(userId: string, providerItemId: string | null) {
  const prefix = `${userId}:`;
  if (!providerItemId?.startsWith(prefix)) throw new Error("Provider connection identifier is invalid");
  return providerItemId.slice(prefix.length);
}

export async function createSnapTradeConnectionPortal(
  userId: string,
  suppliedCredential: { clientId: string; consumerKey: string } | null,
  redirectUrl: string,
  connectionId?: string,
) {
  const storedCredential = suppliedCredential ? null : await getProviderCredential(userId, "snaptrade");
  const credential = suppliedCredential || (storedCredential ? parseSnapTradeCredential(storedCredential) : null);
  if (!credential) throw new Error("Enter your SnapTrade Personal Client ID and Consumer Key first");
  let reconnect: string | undefined;
  if (connectionId) {
    const connection = await prisma.brokerageConnection.findFirst({ where: brokerageOwnershipWhere(userId, connectionId) });
    if (!connection || connection.provider !== "snaptrade") throw new Error("SnapTrade connection not found");
    reconnect = unscopedProviderItemId(userId, connection.providerItemId);
  }
  if (suppliedCredential) {
    await saveProviderCredential(userId, "snaptrade", serializeSnapTradeCredential(credential));
  }
  return createSnapTradePortal(credential, redirectUrl, reconnect);
}

export async function finalizeSnapTradeConnections(userId: string) {
  const encryptedCredential = await getProviderCredential(userId, "snaptrade");
  if (!encryptedCredential) throw new Error("Connect SnapTrade Personal before synchronizing brokerage accounts");
  const credential = parseSnapTradeCredential(encryptedCredential);
  const authorizations = await listSnapTradeAuthorizations(credential);
  if (!authorizations.length) throw new Error("SnapTrade did not return any brokerage connections");
  const activeScopedIds: string[] = [];

  for (const authorization of authorizations) {
    const providerItemId = scopedProviderItemId(userId, authorization.id);
    activeScopedIds.push(providerItemId);
    const existing = await prisma.brokerageConnection.findUnique({
      where: { provider_providerItemId: { provider: "snaptrade", providerItemId } },
      select: { userId: true },
    });
    assertBrokerageConnectionOwnership(existing?.userId, userId);
    await prisma.brokerageConnection.upsert({
      where: { provider_providerItemId: { provider: "snaptrade", providerItemId } },
      update: {
        institutionId: authorization.id,
        institutionName: authorization.institutionName,
        institutionLogoUrl: authorization.institutionLogoUrl,
        status: authorization.status,
      },
      create: {
        userId,
        provider: "snaptrade",
        providerItemId,
        institutionId: authorization.id,
        institutionName: authorization.institutionName,
        institutionLogoUrl: authorization.institutionLogoUrl,
        status: authorization.status,
      },
    });
  }

  await prisma.brokerageConnection.updateMany({
    where: { userId, provider: "snaptrade", providerItemId: { notIn: activeScopedIds }, status: { not: "disconnected" } },
    data: { status: "disconnected" },
  });
  const connections = await prisma.brokerageConnection.findMany({
    where: { userId, provider: "snaptrade", providerItemId: { in: activeScopedIds } },
  });
  const results = [];
  for (const connection of connections) {
    try {
      results.push(await syncBrokerageConnection(userId, connection.id));
    } catch (error) {
      results.push({ id: connection.id, status: "error", error: error instanceof Error ? error.message : "Sync failed" });
    }
  }
  return results;
}

export async function syncBrokerageConnection(userId: string, connectionId: string) {
  const connection = await prisma.brokerageConnection.findFirst({ where: brokerageOwnershipWhere(userId, connectionId) });
  if (!connection) throw new Error("Brokerage connection not found");
  if (connection.status === "disconnected") throw new Error("Brokerage connection is disconnected");
  if (connection.provider === "plaid" && !connection.providerAccessTokenEncrypted) {
    throw new Error("Brokerage connection is missing its provider token");
  }

  const startedAt = new Date();
  try {
    let sync: BrokerageSyncResult;
    if (connection.provider === "snaptrade") {
      const stored = await getProviderCredential(userId, "snaptrade");
      if (!stored) throw new Error("SnapTrade Personal credentials are missing");
      sync = await syncSnapTradeAuthorization(
        parseSnapTradeCredential(stored),
        unscopedProviderItemId(userId, connection.providerItemId),
      );
    } else {
      const token = decryptSecret(connection.providerAccessTokenEncrypted as string);
      sync = await providerFor(connection.provider).syncConnection(token);
    }
    await writeSyncData(userId, connection.id, sync);
    const updated = await prisma.brokerageConnection.update({
      where: { id: connection.id },
      data: {
        institutionId: sync.institutionId || connection.institutionId,
        institutionName: sync.institutionName || connection.institutionName,
        institutionLogoUrl: sync.institutionLogoUrl || connection.institutionLogoUrl,
        status: "active",
        lastSyncedAt: new Date(),
      },
    });
    await prisma.brokerageSyncLog.create({
      data: {
        userId,
        brokerageConnectionId: connection.id,
        provider: connection.provider,
        status: "success",
        message: "Brokerage sync completed",
        startedAt,
        finishedAt: new Date(),
      },
    });
    return safeBrokerageConnection(updated);
  } catch (error) {
    await prisma.brokerageConnection.update({
      where: { id: connection.id },
      data: { status: error instanceof ProviderReauthenticationError ? "requires_reauth" : "error" },
    });
    await prisma.brokerageSyncLog.create({
      data: {
        userId,
        brokerageConnectionId: connection.id,
        provider: connection.provider,
        status: "failed",
        message: error instanceof Error ? error.message : "Brokerage sync failed",
        startedAt,
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function syncAllBrokerageConnections(userId: string) {
  const connections = await prisma.brokerageConnection.findMany({
    where: { userId, status: { in: ["active", "error", "requires_reauth"] } },
    orderBy: { createdAt: "asc" },
  });

  const results = [];
  for (const connection of connections) {
    try {
      results.push(await syncBrokerageConnection(userId, connection.id));
    } catch (error) {
      results.push({
        id: connection.id,
        provider: connection.provider,
        institutionName: connection.institutionName,
        status: "error",
        error: error instanceof Error ? error.message : "Sync failed",
      });
    }
  }
  return results;
}

export async function disconnectBrokerageConnection(userId: string, connectionId: string, deleteData = false) {
  const connection = await prisma.brokerageConnection.findFirst({ where: brokerageOwnershipWhere(userId, connectionId) });
  if (!connection) throw new Error("Brokerage connection not found");

  if (connection.provider === "snaptrade") {
    const stored = await getProviderCredential(userId, "snaptrade");
    if (stored) {
      try {
        await deleteSnapTradeAuthorization(
          parseSnapTradeCredential(stored),
          unscopedProviderItemId(userId, connection.providerItemId),
        );
      } catch (error) {
        const status = (error as { response?: { status?: number } })?.response?.status;
        if (status !== 404) throw error;
      }
    }
  }

  if (deleteData) {
    await prisma.stockTransaction.deleteMany({ where: { userId, brokerageConnectionId: connectionId } });
    await prisma.stockHolding.deleteMany({ where: { userId, brokerageConnectionId: connectionId } });
    await prisma.brokerageAccount.deleteMany({ where: { userId, brokerageConnectionId: connectionId } });
  }

  const updated = await prisma.brokerageConnection.update({
    where: { id: connectionId },
    data: {
      providerAccessTokenEncrypted: null,
      status: "disconnected",
    },
  });

  if (connection.provider === "snaptrade") {
    const remaining = await prisma.brokerageConnection.count({
      where: { userId, provider: "snaptrade", status: { not: "disconnected" } },
    });
    if (!remaining) await deleteProviderCredential(userId, "snaptrade");
  }

  return safeBrokerageConnection(updated);
}

export async function getStocksPortfolio(userId: string) {
  const [connections, accounts, holdings, transactions] = await Promise.all([
    prisma.brokerageConnection.findMany({
      where: { userId },
      orderBy: [{ status: "asc" }, { institutionName: "asc" }],
    }),
    prisma.brokerageAccount.findMany({
      where: { userId },
      orderBy: [{ brokerName: "asc" }, { accountName: "asc" }],
    }),
    prisma.stockHolding.findMany({
      where: { userId },
      include: { brokerageAccount: { select: { accountName: true, brokerName: true } } },
      orderBy: [{ marketValue: "desc" }],
    }),
    prisma.stockTransaction.findMany({
      where: { userId },
      include: { brokerageAccount: { select: { accountName: true, brokerName: true } } },
      orderBy: [{ date: "desc" }],
      take: 500,
    }),
  ]);

  const safeHoldings = holdings.map(serializeHolding);
  const summary = calculateStocksPortfolioSummary(safeHoldings as unknown as NormalizedStockHolding[]);

  return {
    connections: connections.map(safeBrokerageConnection),
    accounts: accounts.map(serializeAccount),
    holdings: safeHoldings,
    transactions: transactions.map(serializeTransaction),
    summary,
  };
}
