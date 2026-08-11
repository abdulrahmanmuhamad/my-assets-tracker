import "server-only";
import type { BankSyncResult, NormalizedBankAccount, NormalizedBankTransaction } from "./types";

const SIMPLEFIN_HOSTS = new Set(["bridge.simplefin.org", "beta-bridge.simplefin.org"]);
const MAX_RESPONSE_BYTES = 5_000_000;

type SimpleFinConnection = {
  conn_id?: unknown;
  name?: unknown;
  org_id?: unknown;
  org_name?: unknown;
};

type SimpleFinTransaction = {
  id?: unknown;
  posted?: unknown;
  amount?: unknown;
  description?: unknown;
  transacted_at?: unknown;
  pending?: unknown;
  extra?: unknown;
};

type SimpleFinAccount = {
  id?: unknown;
  name?: unknown;
  conn_id?: unknown;
  conn_name?: unknown;
  currency?: unknown;
  balance?: unknown;
  "available-balance"?: unknown;
  "balance-date"?: unknown;
  transactions?: unknown;
  extra?: unknown;
};

type SimpleFinPayload = {
  errlist?: unknown;
  errors?: unknown;
  connections?: unknown;
  accounts?: unknown;
};

export type SimpleFinConnectionSync = {
  providerItemId: string;
  institutionId: string | null;
  institutionName: string;
  sync: BankSyncResult;
};

function safeText(value: unknown, fallback: string, maxLength = 200) {
  const text = typeof value === "string" ? value.trim() : "";
  return (text || fallback).slice(0, maxLength);
}

function finiteNumber(value: unknown) {
  const parsed = typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : null;
}

function epochDate(value: unknown, fallback = new Date()) {
  const epoch = finiteNumber(value);
  if (epoch === null || epoch <= 0) return fallback;
  const date = new Date(epoch * 1000);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function validateSimpleFinUrl(value: string, purpose: "claim" | "access") {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`SimpleFIN ${purpose} URL is invalid`);
  }
  if (url.protocol !== "https:" || !SIMPLEFIN_HOSTS.has(url.hostname) || url.port) {
    throw new Error(`SimpleFIN ${purpose} URL is not from the official SimpleFIN Bridge`);
  }
  if (purpose === "claim" && (!url.pathname.startsWith("/simplefin/claim/") || url.username || url.password)) {
    throw new Error("SimpleFIN setup token has an invalid claim URL");
  }
  if (purpose === "access" && (!url.pathname.startsWith("/simplefin") || !url.username || !url.password)) {
    throw new Error("SimpleFIN Bridge returned an invalid access URL");
  }
  return url;
}

export function decodeSimpleFinSetupToken(setupToken: string) {
  let decoded = "";
  try {
    decoded = Buffer.from(setupToken.trim(), "base64").toString("utf8");
  } catch {
    throw new Error("SimpleFIN setup token is not valid Base64");
  }
  if (!decoded || decoded.length > 4096) throw new Error("SimpleFIN setup token is invalid");
  return validateSimpleFinUrl(decoded, "claim").toString();
}

export async function claimSimpleFinSetupToken(setupToken: string) {
  const claimUrl = decodeSimpleFinSetupToken(setupToken);
  const response = await fetch(claimUrl, {
    method: "POST",
    headers: { "Content-Length": "0" },
    redirect: "error",
    signal: AbortSignal.timeout(20_000),
  });
  if (response.status === 403) {
    throw new Error("This SimpleFIN setup token has expired or was already claimed. Disable it in SimpleFIN and create a new token.");
  }
  if (!response.ok) throw new Error("SimpleFIN could not claim this setup token");
  const accessUrl = (await response.text()).trim();
  if (!accessUrl || accessUrl.length > 4096) throw new Error("SimpleFIN returned an invalid access URL");
  return validateSimpleFinUrl(accessUrl, "access").toString();
}

function accountType(account: SimpleFinAccount) {
  const extra = record(account.extra);
  const rawType = safeText(extra["account-type"] || extra.type || account.name, "deposit").toLowerCase();
  if (/credit|card/.test(rawType)) return { type: "credit", subtype: "credit card", isDebt: true };
  if (/loan|mortgage|line of credit/.test(rawType)) return { type: "loan", subtype: rawType, isDebt: true };
  if (/checking/.test(rawType)) return { type: "depository", subtype: "checking", isDebt: false };
  if (/saving/.test(rawType)) return { type: "depository", subtype: "savings", isDebt: false };
  return { type: "depository", subtype: rawType.slice(0, 80), isDebt: false };
}

function normalizeAccount(account: SimpleFinAccount, institutionName: string): NormalizedBankAccount | null {
  const providerAccountId = safeText(account.id, "", 300);
  if (!providerAccountId) return null;
  const type = accountType(account);
  const extra = record(account.extra);
  const rawMask = safeText(extra["last-four"] || extra.mask, "", 20).replace(/\D/g, "").slice(-4);
  return {
    providerAccountId,
    institutionName,
    accountName: safeText(account.name, "Bank account"),
    officialName: null,
    accountType: type.type,
    accountSubtype: type.subtype,
    mask: rawMask || null,
    currency: safeText(account.currency, "USD", 16),
    currentBalance: finiteNumber(account.balance),
    availableBalance: finiteNumber(account["available-balance"]) ?? finiteNumber(account.balance),
    creditLimit: null,
    includeInLiquidCash: false,
    isDebtAccount: type.isDebt,
    lastBalanceUpdatedAt: epochDate(account["balance-date"]),
  };
}

function normalizeTransactions(account: SimpleFinAccount): NormalizedBankTransaction[] {
  const accountId = safeText(account.id, "", 300);
  const currency = safeText(account.currency, "USD", 16);
  if (!accountId || !Array.isArray(account.transactions)) return [];
  return (account.transactions as SimpleFinTransaction[]).flatMap((transaction) => {
    const id = safeText(transaction.id, "", 300);
    const simpleFinAmount = finiteNumber(transaction.amount);
    if (!id || simpleFinAmount === null) return [];
    const pending = transaction.pending === true || finiteNumber(transaction.posted) === 0;
    const extra = record(transaction.extra);
    const posted = epochDate(transaction.posted, epochDate(transaction.transacted_at));
    return [{
      providerTransactionId: `${accountId}:${id}`,
      providerAccountId: accountId,
      date: posted,
      authorizedDate: transaction.transacted_at ? epochDate(transaction.transacted_at) : null,
      name: safeText(transaction.description, "Bank transaction", 500),
      merchantName: null,
      category: typeof extra.category === "string" ? extra.category.slice(0, 200) : null,
      personalFinanceCategory: null,
      amount: -simpleFinAmount,
      currency,
      pending,
      paymentChannel: null,
      transactionType: simpleFinAmount >= 0 ? "deposit" : "withdrawal",
    }];
  });
}

function payloadWarnings(payload: SimpleFinPayload) {
  const structured = Array.isArray(payload.errlist) ? payload.errlist : [];
  const deprecated = Array.isArray(payload.errors) ? payload.errors : [];
  const count = structured.length + deprecated.length;
  return count ? [`SimpleFIN reported ${count} account or connection warning${count === 1 ? "" : "s"}`] : [];
}

export function normalizeSimpleFinPayload(payload: SimpleFinPayload): SimpleFinConnectionSync[] {
  const connections = Array.isArray(payload.connections) ? payload.connections as SimpleFinConnection[] : [];
  const accounts = Array.isArray(payload.accounts) ? payload.accounts as SimpleFinAccount[] : [];
  const connectionById = new Map(connections.map((connection) => [safeText(connection.conn_id, "", 300), connection]));
  const connectionIds = new Set([
    ...connectionById.keys(),
    ...accounts.map((account) => safeText(account.conn_id, "default", 300)),
  ]);
  const warnings = payloadWarnings(payload);

  return [...connectionIds].filter(Boolean).map((connectionId) => {
    const descriptor = connectionById.get(connectionId);
    const scopedAccounts = accounts.filter((account) => safeText(account.conn_id, "default", 300) === connectionId);
    const institutionName = safeText(descriptor?.org_name || descriptor?.name || scopedAccounts[0]?.conn_name, "Connected bank");
    return {
      providerItemId: connectionId,
      institutionId: safeText(descriptor?.org_id, "", 300) || null,
      institutionName,
      sync: {
        providerItemId: connectionId,
        institutionId: safeText(descriptor?.org_id, "", 300) || null,
        institutionName,
        institutionLogoUrl: null,
        productsEnabled: ["accounts", "balances", "transactions"],
        accounts: scopedAccounts.map((account) => normalizeAccount(account, institutionName)).filter((account): account is NormalizedBankAccount => Boolean(account)),
        transactions: scopedAccounts.flatMap(normalizeTransactions),
        removedTransactionIds: [],
        transactionsCursor: null,
        warnings,
      },
    };
  });
}

export async function fetchSimpleFinSnapshot(accessUrl: string, lastSyncedAt?: Date | null) {
  const source = validateSimpleFinUrl(accessUrl, "access");
  const username = decodeURIComponent(source.username);
  const password = decodeURIComponent(source.password);
  source.username = "";
  source.password = "";
  source.pathname = `${source.pathname.replace(/\/$/, "")}/accounts`;
  const now = new Date();
  const start = lastSyncedAt
    ? new Date(lastSyncedAt.getTime() - 5 * 24 * 60 * 60 * 1000)
    : new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
  source.search = new URLSearchParams({
    version: "2",
    pending: "1",
    "start-date": String(Math.floor(start.getTime() / 1000)),
    "end-date": String(Math.floor((now.getTime() + 24 * 60 * 60 * 1000) / 1000)),
  }).toString();

  const response = await fetch(source, {
    headers: { Authorization: `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}` },
    redirect: "error",
    signal: AbortSignal.timeout(30_000),
  });
  if (response.status === 402) throw new Error("SimpleFIN subscription payment is required");
  if (response.status === 403) throw new Error("SimpleFIN access was revoked. Connect again with a new setup token.");
  if (!response.ok) throw new Error("SimpleFIN could not refresh bank data");
  const contentLength = Number(response.headers.get("content-length") || 0);
  if (contentLength > MAX_RESPONSE_BYTES) throw new Error("SimpleFIN response was unexpectedly large");
  const text = await response.text();
  if (text.length > MAX_RESPONSE_BYTES) throw new Error("SimpleFIN response was unexpectedly large");
  let payload: SimpleFinPayload;
  try {
    payload = JSON.parse(text) as SimpleFinPayload;
  } catch {
    throw new Error("SimpleFIN returned invalid account data");
  }
  return normalizeSimpleFinPayload(payload);
}
