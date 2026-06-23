import "server-only";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/encryption";
import { toNumber } from "@/lib/calculations";
import { calculateAllBanksSummary } from "./calculations";
import { exchangeBankPublicToken as exchangePlaidToken, syncPlaidBankAccessToken } from "./plaid-bank-provider";
import { assertBankConnectionOwnership, bankAccountOwnershipWhere, bankOwnershipWhere, safeBankConnection } from "./security";
import type { BankSyncResult } from "./types";

function serializeAccount(account: {
  id: string;
  bankConnectionId: string;
  providerAccountId: string;
  institutionName: string;
  accountName: string;
  officialName: string | null;
  accountType: string;
  accountSubtype: string | null;
  mask: string | null;
  currency: string;
  currentBalance: unknown;
  availableBalance: unknown;
  creditLimit: unknown;
  includeInLiquidCash: boolean;
  isDebtAccount: boolean;
  syncStatus: string;
  lastBalanceUpdatedAt: Date | null;
  updatedAt: Date;
}) {
  return {
    ...account,
    currentBalance: account.currentBalance === null ? null : toNumber(account.currentBalance as never),
    availableBalance: account.availableBalance === null ? null : toNumber(account.availableBalance as never),
    creditLimit: account.creditLimit === null ? null : toNumber(account.creditLimit as never),
    lastBalanceUpdatedAt: account.lastBalanceUpdatedAt?.toISOString() || null,
    updatedAt: account.updatedAt.toISOString(),
  };
}

function serializeTransaction(transaction: {
  id: string;
  bankAccountId: string;
  bankConnectionId: string;
  providerTransactionId: string;
  date: Date;
  authorizedDate: Date | null;
  name: string;
  merchantName: string | null;
  category: string | null;
  personalFinanceCategory: string | null;
  amount: unknown;
  currency: string;
  pending: boolean;
  paymentChannel: string | null;
  transactionType: string | null;
  notes: string | null;
  bankAccount?: { accountName: string } | null;
}) {
  return {
    ...transaction,
    accountName: transaction.bankAccount?.accountName || "",
    amount: toNumber(transaction.amount as never),
    date: transaction.date.toISOString().slice(0, 10),
    authorizedDate: transaction.authorizedDate?.toISOString().slice(0, 10) || null,
  };
}

async function writeBankSyncData(userId: string, connectionId: string, sync: BankSyncResult) {
  const accountIdByProviderId = new Map<string, string>();
  const activeProviderAccountIds: string[] = [];

  for (const account of sync.accounts) {
    activeProviderAccountIds.push(account.providerAccountId);
    const saved = await prisma.bankAccount.upsert({
      where: {
        bankConnectionId_providerAccountId: {
          bankConnectionId: connectionId,
          providerAccountId: account.providerAccountId,
        },
      },
      update: {
        institutionName: account.institutionName,
        accountName: account.accountName,
        officialName: account.officialName,
        accountType: account.accountType,
        accountSubtype: account.accountSubtype,
        mask: account.mask,
        currency: account.currency,
        currentBalance: account.currentBalance,
        availableBalance: account.availableBalance,
        creditLimit: account.creditLimit,
        isDebtAccount: account.isDebtAccount,
        syncStatus: "synced",
        lastBalanceUpdatedAt: account.lastBalanceUpdatedAt,
      },
      create: {
        userId,
        bankConnectionId: connectionId,
        providerAccountId: account.providerAccountId,
        institutionName: account.institutionName,
        accountName: account.accountName,
        officialName: account.officialName,
        accountType: account.accountType,
        accountSubtype: account.accountSubtype,
        mask: account.mask,
        currency: account.currency,
        currentBalance: account.currentBalance,
        availableBalance: account.availableBalance,
        creditLimit: account.creditLimit,
        includeInLiquidCash: account.includeInLiquidCash,
        isDebtAccount: account.isDebtAccount,
        syncStatus: "synced",
        lastBalanceUpdatedAt: account.lastBalanceUpdatedAt,
      },
    });
    accountIdByProviderId.set(account.providerAccountId, saved.id);
  }

  if (activeProviderAccountIds.length) {
    await prisma.bankAccount.deleteMany({
      where: { userId, bankConnectionId: connectionId, providerAccountId: { notIn: activeProviderAccountIds } },
    });
  }

  for (const transaction of sync.transactions) {
    const bankAccountId = accountIdByProviderId.get(transaction.providerAccountId);
    if (!bankAccountId) continue;
    await prisma.bankTransaction.upsert({
      where: {
        bankConnectionId_providerTransactionId: {
          bankConnectionId: connectionId,
          providerTransactionId: transaction.providerTransactionId,
        },
      },
      update: {
        bankAccountId,
        date: transaction.date,
        authorizedDate: transaction.authorizedDate,
        name: transaction.name,
        merchantName: transaction.merchantName,
        category: transaction.category,
        personalFinanceCategory: transaction.personalFinanceCategory,
        amount: transaction.amount,
        currency: transaction.currency,
        pending: transaction.pending,
        paymentChannel: transaction.paymentChannel,
        transactionType: transaction.transactionType,
      },
      create: {
        userId,
        bankAccountId,
        bankConnectionId: connectionId,
        providerTransactionId: transaction.providerTransactionId,
        date: transaction.date,
        authorizedDate: transaction.authorizedDate,
        name: transaction.name,
        merchantName: transaction.merchantName,
        category: transaction.category,
        personalFinanceCategory: transaction.personalFinanceCategory,
        amount: transaction.amount,
        currency: transaction.currency,
        pending: transaction.pending,
        paymentChannel: transaction.paymentChannel,
        transactionType: transaction.transactionType,
      },
    });
  }

  if (sync.removedTransactionIds.length) {
    await prisma.bankTransaction.deleteMany({
      where: {
        userId,
        bankConnectionId: connectionId,
        providerTransactionId: { in: sync.removedTransactionIds },
      },
    });
  }
}

export async function exchangeBankPublicToken(userId: string, publicToken: string) {
  const result = await exchangePlaidToken(publicToken);
  const existing = await prisma.bankConnection.findUnique({
    where: { provider_providerItemId: { provider: "plaid", providerItemId: result.providerItemId } },
    select: { userId: true },
  });
  assertBankConnectionOwnership(existing?.userId, userId);
  const warning = result.sync.warnings.join("; ") || null;
  const connection = await prisma.bankConnection.upsert({
    where: { provider_providerItemId: { provider: "plaid", providerItemId: result.providerItemId } },
    update: {
      userId,
      providerAccessTokenEncrypted: encryptSecret(result.accessToken),
      institutionId: result.sync.institutionId,
      institutionName: result.sync.institutionName || "Connected bank",
      institutionLogoUrl: result.sync.institutionLogoUrl,
      productsEnabled: result.sync.productsEnabled as Prisma.InputJsonValue,
      transactionsCursor: result.sync.transactionsCursor,
      syncWarning: warning,
      status: warning ? "warning" : "active",
      lastSyncedAt: new Date(),
    },
    create: {
      userId,
      provider: "plaid",
      providerItemId: result.providerItemId,
      providerAccessTokenEncrypted: encryptSecret(result.accessToken),
      institutionId: result.sync.institutionId,
      institutionName: result.sync.institutionName || "Connected bank",
      institutionLogoUrl: result.sync.institutionLogoUrl,
      productsEnabled: result.sync.productsEnabled as Prisma.InputJsonValue,
      transactionsCursor: result.sync.transactionsCursor,
      syncWarning: warning,
      status: warning ? "warning" : "active",
      lastSyncedAt: new Date(),
    },
  });
  await writeBankSyncData(userId, connection.id, result.sync);
  await prisma.bankSyncLog.create({
    data: {
      userId,
      bankConnectionId: connection.id,
      provider: "plaid",
      status: warning ? "partial" : "success",
      message: warning || "Initial bank sync completed",
      finishedAt: new Date(),
    },
  });
  return safeBankConnection(connection);
}

export async function syncBankConnection(userId: string, connectionId: string) {
  const connection = await prisma.bankConnection.findFirst({ where: bankOwnershipWhere(userId, connectionId) });
  if (!connection) throw new Error("Bank connection not found");
  if (connection.status === "disconnected") throw new Error("Bank connection is disconnected");
  if (!connection.providerAccessTokenEncrypted) throw new Error("Bank connection is missing its provider token");

  const startedAt = new Date();
  try {
    const sync = await syncPlaidBankAccessToken(
      decryptSecret(connection.providerAccessTokenEncrypted),
      connection.transactionsCursor,
    );
    await writeBankSyncData(userId, connection.id, sync);
    const warning = sync.warnings.join("; ") || null;
    const updated = await prisma.bankConnection.update({
      where: { id: connection.id },
      data: {
        institutionId: sync.institutionId || connection.institutionId,
        institutionName: sync.institutionName || connection.institutionName,
        institutionLogoUrl: sync.institutionLogoUrl || connection.institutionLogoUrl,
        productsEnabled: sync.productsEnabled as Prisma.InputJsonValue,
        transactionsCursor: sync.transactionsCursor,
        syncWarning: warning,
        status: warning ? "warning" : "active",
        lastSyncedAt: new Date(),
      },
    });
    await prisma.bankSyncLog.create({
      data: {
        userId,
        bankConnectionId: connection.id,
        provider: connection.provider,
        status: warning ? "partial" : "success",
        message: warning || "Bank sync completed",
        startedAt,
        finishedAt: new Date(),
      },
    });
    return safeBankConnection(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Bank sync failed";
    await prisma.bankConnection.update({ where: { id: connection.id }, data: { status: "error", syncWarning: message } });
    await prisma.bankSyncLog.create({
      data: {
        userId,
        bankConnectionId: connection.id,
        provider: connection.provider,
        status: "failed",
        message,
        startedAt,
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

export async function syncAllBankConnections(userId: string) {
  const connections = await prisma.bankConnection.findMany({
    where: { userId, status: { in: ["active", "warning", "error", "requires_reauth"] } },
    orderBy: { createdAt: "asc" },
  });
  const results = [];
  for (const connection of connections) {
    try {
      results.push(await syncBankConnection(userId, connection.id));
    } catch (error) {
      results.push({ id: connection.id, status: "error", error: error instanceof Error ? error.message : "Sync failed" });
    }
  }
  return results;
}

export async function disconnectBankConnection(userId: string, connectionId: string, deleteData = false) {
  const connection = await prisma.bankConnection.findFirst({ where: bankOwnershipWhere(userId, connectionId) });
  if (!connection) throw new Error("Bank connection not found");
  if (deleteData) {
    await prisma.bankTransaction.deleteMany({ where: { userId, bankConnectionId: connectionId } });
    await prisma.bankAccount.deleteMany({ where: { userId, bankConnectionId: connectionId } });
  }
  const updated = await prisma.bankConnection.update({
    where: { id: connectionId },
    data: { providerAccessTokenEncrypted: null, transactionsCursor: null, status: "disconnected" },
  });
  return safeBankConnection(updated);
}

export async function updateBankAccountLiquidCash(userId: string, accountId: string, includeInLiquidCash: boolean) {
  const account = await prisma.bankAccount.findFirst({ where: bankAccountOwnershipWhere(userId, accountId) });
  if (!account) throw new Error("Bank account not found");
  if (account.accountType.toLowerCase() !== "depository") throw new Error("Only depository accounts can be included in liquid cash");
  return serializeAccount(
    await prisma.bankAccount.update({ where: { id: account.id }, data: { includeInLiquidCash } }),
  );
}

export async function getBanksPortfolio(userId: string) {
  const [connections, accounts, transactions] = await Promise.all([
    prisma.bankConnection.findMany({ where: { userId }, orderBy: [{ status: "asc" }, { institutionName: "asc" }] }),
    prisma.bankAccount.findMany({ where: { userId }, orderBy: [{ institutionName: "asc" }, { accountName: "asc" }] }),
    prisma.bankTransaction.findMany({
      where: { userId },
      include: { bankAccount: { select: { accountName: true } } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 500,
    }),
  ]);
  const safeAccounts = accounts.map(serializeAccount);
  const summary = calculateAllBanksSummary(safeAccounts);
  return {
    connections: connections.map(safeBankConnection),
    accounts: safeAccounts,
    transactions: transactions.map(serializeTransaction),
    summary: {
      ...summary,
      connectedBanks: connections.filter((connection) => connection.status !== "disconnected").length,
      lastSyncedAt:
        connections.reduce<Date | null>((latest, connection) =>
          !latest || (connection.lastSyncedAt && connection.lastSyncedAt > latest) ? connection.lastSyncedAt : latest, null)?.toISOString() || null,
    },
  };
}

export async function getBankAccount(userId: string, accountId: string) {
  const account = await prisma.bankAccount.findFirst({ where: bankAccountOwnershipWhere(userId, accountId) });
  return account ? serializeAccount(account) : null;
}

export async function getBankTransactions(userId: string, accountId?: string) {
  const transactions = await prisma.bankTransaction.findMany({
    where: { userId, ...(accountId ? { bankAccountId: accountId } : {}) },
    include: { bankAccount: { select: { accountName: true } } },
    orderBy: [{ date: "desc" }, { createdAt: "desc" }],
    take: 500,
  });
  return transactions.map(serializeTransaction);
}
